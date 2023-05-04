const deployQuery = require("../fqlx/queries/deploy");
const removeQuery = require("../fqlx/queries/remove");
const { ServiceError, fql } = require("fauna");

class FQLXCommands {
  command = {
    deploy: {
      usage: "Deploy Fauna FQL X schema. (beta)",
      lifecycleEvents: ["deploy"],
    },
    remove: {
      usage: "Remove Fauna FQL X schema. (beta)",
      lifecycleEvents: ["remove"],
    },
  };

  hooks = {
    "fqlx:deploy:deploy": this.deploy.bind(this),
    "fqlx:remove:remove": this.remove.bind(this),
  };

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
    }
  }

  async deploy() {
    const { functions = {} } = this.config;

    await this.tryLog(async () => {
      this.logger.info("FQL X schema create/update transaction in progress...");

      const q = deployQuery(this.adapt({ functions }));
      // Example expected data:
      // res.data -> [ { type: "function", name: "MyFunc", result: "created" } ]
      const res = await this.client.query(q);

      res.data.forEach((record) => {
        if (record.result !== "noop") {
          this.logger.success(
            `${record.type}: ${record.name} ${record.result}`
          );
        }
      });
    });

    await this.remove(true);
  }

  async remove(withDeploy = false) {
    let { functions = {} } = this.config;

    if (!withDeploy) {
      functions = {};
    }

    /**
     * Logs a remove record
     *
     * @param record A remove record E.g. { type: "function", name: "MyDeletedFunc", result: "deleted" }
     */
    const log = (record) => {
      this.logger.error(`${record.type}: ${record.name} ${record.result}`);
    };

    /**
     * Paginates a Fauna set until the after token is null and logs the results of each page.
     *
     * @param page A Page to paginate and log until complete.
     * @returns {Promise<void>}
     */
    const paginate = async (page) => {
      let a = page.after;
      while (a != null) {
        const res = await this.client.query(fql`Set.paginate(${a})`);

        for (const d of res.data?.data ?? []) {
          log(d);
        }

        a = res.data?.after;
      }
    };

    await this.tryLog(async () => {
      this.logger.info("FQL X schema remove transactions in progress...");

      const q = removeQuery(this.adapt({ functions }));

      // Example response data:
      // res.data -> [ Page(data={ type: "function", name: "MyDeletedFunc", result: "deleted" },after=null], ... ]
      const res = await this.client.query(q);

      // Loop through array of embedded sets
      for (const group of res.data) {
        // Loop through each element in the set and log the record
        for (const record of group.data ?? []) {
          log(record);
        }

        // If there's an after token in the embedded set, we have to paginate
        if (group.after != null) {
          await paginate(group);
        }
      }
    });
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
    return {
      functions: Object.entries(functions).map(([k, v]) => {
        return { name: k, ...v, data: this.mergeMetadata(v.data) };
      }),
    };
  }
}

module.exports = FQLXCommands;
