const deployQuery = require("../fauna/v10/queries/deploy");
const removeQuery = require("../fauna/v10/queries/remove");
const { ServiceError } = require("fauna");

class FQL10Commands {
  constructor({ config, faunaClient, logger }) {
    this.config = config;
    this.client = faunaClient;
    this.logger = logger;
    this.defaultMetadata = {
      created_by_serverless_plugin: "fauna:v10",
      deletion_policy: config?.deletion_policy || "destroy",
    };
  }

  mergeMetadata(data = {}) {
    return { ...this.defaultMetadata, ...data };
  }

  async tryLog(fn) {
    try {
      await fn();
    } catch (e) {
      if (e instanceof ServiceError) {
        this.logger.error(
          `${e.code}: ${e.message}\n---\n${e.queryInfo?.summary}`
        );
      } else {
        this.logger.error(e);
      }

      // Rethrow so we non-zero exit
      throw e;
    }
  }

  buildMessage(record) {
    return `${record.type} ${record.name}: ${record.action}`;
  }

  async deploy() {
    const { functions = {} } = this.config;

    await this.tryLog(async () => {
      this.logger.info("FQL 10 schema update in progress...");

      const q = deployQuery(this.adapt({ functions }));
      // Example expected data:
      // res.data -> [ { type: "function", name: "MyFunc", result: "created" } ]
      const res = await this.client.query(q);

      res.data.flat().forEach((r) => {
        this.logger.success(this.buildMessage(r));
      });

      await this.remove(true);

      this.logger.info("FQL 10 schema update complete");
    });
  }

  async remove(withDeploy = false) {
    let { functions = {} } = this.config;

    if (!withDeploy) {
      functions = {};
      this.logger.info("FQL 10 schema remove in progress...");
    }

    await this.tryLog(async () => {
      const q = removeQuery(this.adapt({ functions }));

      // Example response data:
      // res.data -> [[{ type: "function", name: "MyDeletedFunc", result: "deleted" }, ...], ... ]
      const res = await this.client.query(q);

      res.data.flat(2).forEach((r) => {
        this.logger.error(this.buildMessage(r));
      });
    });

    if (!withDeploy) {
      this.logger.info("FQL 10 schema remove complete");
    }
  }

  /**
   * Takes an object containing resource definitions and adapts them into a format ready for Fauna.
   *
   * @param An object containing resource definitions.
   *        E.g. {
   *          functions: {
   *            MyFunction: { body: "x => x + 1" }
   *          }
   *        }
   * @returns An an object containing arrays of resource definitions by resource type.
   *          E.g. {
   *            functions: [ { name: "MyFunction", body: "x => x + 1" }]
   *          }
   *
   */
  adapt({ functions = {} }) {
    const toArray = (obj) =>
      Object.entries(obj).map(([k, v]) => {
        return { name: k, ...v, data: this.mergeMetadata(v.data) };
      });

    return {
      functions: toArray(functions),
    };
  }
}

module.exports = FQL10Commands;
