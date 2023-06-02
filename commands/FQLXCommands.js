const deployQuery = require("../fqlx/queries/deploy");
const removeQuery = require("../fqlx/queries/remove");
const { ServiceError, fql } = require("fauna");

class FQLXCommands {
  constructor({ config, faunaClient, logger, options }) {
    this.config = config;
    this.client = faunaClient;
    this.logger = logger;
    this.options = { ...options };
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
    const dryrun = record.dryrun ? "(DryRun) " : "";
    return `${dryrun}${record.type} ${record.name}: ${record.action}`;
  }

  async deploy() {
    const { collections = {}, functions = {}, roles = {} } = this.config;

    await this.tryLog(async () => {
      this.logger.info(
        `${
          this.options.dryrun ? "(DryRun) " : ""
        }FQL 10 schema update in progress...`
      );

      const adapted = this.adapt({ collections, functions, roles });
      const q = deployQuery({ ...adapted, options: this.options });
      // Example expected data:
      // res.data -> [ { type: "function", name: "MyFunc", action: "created" } ]
      const res = await this.client.query(q);

      res.data.flat().forEach((r) => {
        this.logger.success(this.buildMessage(r));
        if (r.original !== undefined && r.result !== undefined) {
          const original = r.original ?? {};
          const result = r.result ?? {};
          const allKeys = [
            ...new Set(Object.keys(original).concat(Object.keys(result))),
          ];
          allKeys.forEach((k) => {
            if (k in original && !(k in result)) {
              this.logger.error(`-   ${k}: ${JSON.stringify(original[k])}`);
            } else if (k in result && !(k in original)) {
              this.logger.success(`+   ${k}: ${JSON.stringify(result[k])}`);
            } else if (
              JSON.stringify(result[k]) !== JSON.stringify(original[k])
            ) {
              this.logger.error(`-   ${k}: ${JSON.stringify(original[k])}`);
              this.logger.success(`+   ${k}: ${JSON.stringify(result[k])}`);
            }
          });
        }
      });

      await this.remove(true);
      this.logger.success(
        `${this.options.dryrun ? "(DryRun) " : ""}FQL 10 schema update complete`
      );
    });
  }

  async remove(withDeploy = false) {
    let { collections = {}, functions = {}, roles = {} } = this.config;

    if (!withDeploy) {
      this.logger.info(
        `${
          this.options.dryrun ? "(DryRun) " : ""
        }FQL 10 schema removal in progress...`
      );
      collections = {};
      functions = {};
      roles = {};
    }

    await this.tryLog(async () => {
      const adapted = this.adapt({ collections, functions, roles });
      const q = removeQuery({ ...adapted, options: this.options });

      // Example response data:
      // res.data -> [ Page(data={ type: "function", name: "MyDeletedFunc", result: "deleted" },after=null], ... ]
      const res = await this.client.query(q);

      res.data.flat(2).forEach((r) => {
        this.logger.error(this.buildMessage(r));
      });
    });

    if (!withDeploy) {
      this.logger.info(
        `${
          this.options.dryrun ? "(DryRun) " : ""
        }FQL 10 schema removal complete`
      );
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
  adapt({ roles = {}, collections = {}, functions = {} }) {
    const toArray = (obj) =>
      Object.entries(obj).map(([k, v]) => {
        return { name: k, ...v, data: this.mergeMetadata(v.data) };
      });

    return {
      roles: toArray(roles),
      collections: toArray(collections).map((c) => {
        c.indexes = c.indexes ?? {};
        c.constraints = c.constraints ?? [];
        Object.entries(c.indexes).forEach(([idxName, idxDef]) => {
          // c.indexes[idxName].values  = c.indexes[idxName].values ?? null
          // c.indexes[idxName].terms = c.indexes[idxName].terms ?? null

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

          // Default queryable to true to make diffing easier
          idxDef.queryable = idxDef.queryable ?? true;
        });

        return c;
      }),
      functions: toArray(functions),
    };
  }
}

module.exports = FQLXCommands;
