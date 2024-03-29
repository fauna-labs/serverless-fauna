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
    return `${record.type}: ${record.name} ${record.action}`;
  }

  async deploy() {
    const { collections = {}, functions = {}, roles = {} } = this.config;

    await this.tryLog(async () => {
      this.logger.info("FQL v10 schema update in progress...");

      const adapted = this.adapt({ collections, functions, roles });
      const q = deployQuery(adapted);
      // Example expected data:
      // res.data -> [ { type: "function", name: "MyFunc", result: "created" } ]
      const res = await this.client.query(q);

      res.data.flat().forEach((record) => {
        this.logger.success(this.buildMessage(record));
      });

      await this.remove(true);
      this.logger.info("FQL v10 schema update complete");
    });
  }

  async remove(withDeploy = false) {
    let { collections = {}, functions = {}, roles = {} } = this.config;

    if (!withDeploy) {
      this.logger.info("FQL v10 schema remove in progress...");
      functions = {};
      collections = {};
      roles = {};
    }

    await this.tryLog(async () => {
      const adapted = this.adapt({ collections, functions, roles });
      const q = removeQuery(adapted);

      const res = await this.client.query(q);

      res.data.flat().forEach((r) => {
        this.logger.error(this.buildMessage(r));
      });
    });

    if (!withDeploy) {
      this.logger.info("FQL v10 schema remove complete");
    }
  }

  /**
   * Takes an object containing resource definitions and adapts them into a format ready for Fauna.
   *
   * @param An object containing resource definitions.
   *        E.g. {
   *          functions: {
   *            MyFunction: { body: "x => x + 1" }
   *          },
   *          collections: {
   *            MyCollection: {}
   *          },
   *          roles: {
   *            MyRole: {}
   *          }
   *        }
   * @returns An an object containing arrays of resource definitions by resource type.
   *          E.g. {
   *            functions: [ { name: "MyFunction", body: "x => x + 1" }],
   *            collections: [ { name: "MyCollection" }],
   *            roles: [ { name: "MyRole" }],
   *          }
   *
   */
  adapt({ collections = {}, functions = {}, roles = {} }) {
    const toArray = (obj) =>
      Object.entries(obj).map(([k, v]) => {
        return { name: k, ...v, data: this.mergeMetadata(v.data) };
      });

    return {
      collections: toArray(collections).map((c) => {
        c.indexes = c.indexes ?? {};
        c.constraints = c.constraints ?? [];
        Object.entries(c.indexes).forEach(([idxName, idxDef]) => {
          // Default index value order to asc to make diffing easier
          if (idxDef.values != null) {
            c.indexes[idxName].values = idxDef.values.map((iv) => {
              if (iv.order == null) {
                return { order: "asc", ...iv };
              } else {
                return iv;
              }
            });
          }
        });

        return c;
      }),
      functions: toArray(functions),
      roles: toArray(roles),
    };
  }
}

module.exports = FQL10Commands;
