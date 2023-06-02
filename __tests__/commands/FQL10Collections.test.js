const FQLXCommands = require("../../commands/FQLXCommands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { objToArray, mergeDefaultMetadata } = require("../utils/objects");
const { cleanup } = require("../utils/cleanup");

describe("FQL10_Collections", () => {
  let faunaClient;
  const log = jest.fn();
  const logger = new Logger({ log });

  const verifyNoCollections = async () => {
    const actual = await faunaClient.query(fql`Collection.all().count()`);
    expect(actual.data).toEqual(0);
  };

  const verifyLogs = (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
    log.mockClear();
  };

  const verify = async (collections) => {
    collections = objToArray(collections);
    const colls = collections
      .map(mergeDefaultMetadata)
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    const actual = await faunaClient.query(
      fql`Collection.all().order( .name ).toArray()`
    );
    if (colls.length !== actual.data.length) {
      expect(actual.data).toEqual(colls);
    }

    for (let i = 0; i < colls.length; i++) {
      const e = colls[i];
      const a = actual.data[i];
      Object.keys(a.indexes).forEach((k) => {
        delete a.indexes[k].status;
      });

      a.constraints.forEach((c) => delete c.status);

      expect(a.data).toEqual(e.data);
      expect(a.indexes).toEqual(e.indexes ?? {});
      expect(a.constraints).toEqual(e.constraints ?? []);
    }
  };

  const runDeploy = async (config, dryrun = false) => {
    const cmd = new FQLXCommands({
      config,
      faunaClient,
      logger,
      options: { dryrun },
    });

    await cmd.deploy();
  };

  const runRemove = async (config, dryrun = false) => {
    const cmd = new FQLXCommands({
      config,
      faunaClient,
      logger,
      options: { dryrun },
    });

    await cmd.remove();
  };

  beforeAll(async () => {
    const p = clientConfig.port;
    const ep = `${clientConfig.scheme}://${clientConfig.domain}${
      p ? ":" + p : ""
    }`;
    faunaClient = new Client({
      secret: clientConfig.secret,
      endpoint: new URL(ep),
    });
    await cleanup(faunaClient);
  });

  beforeEach(async () => {
    await cleanup(faunaClient);
  });

  describe("collection create / update / remove", () => {
    it("manages a collection with data", async () => {
      const config = {
        collections: {
          MyNewCollection: {
            data: { dog: "Scout" },
          },
        },
      };

      // Run create with dryrun
      await runDeploy(config, true);
      let logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Collection MyNewCollection: created",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verifyNoCollections();

      // Run create
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection MyNewCollection: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run noop with dryrun
      await runDeploy(config, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run update with dry run
      const newConfig = {
        collections: {
          MyNewCollection: {
            data: { cat: "Sparky" },
          },
        },
      };
      await runDeploy(newConfig, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Collection MyNewCollection: updated",
        '-   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","dog":"Scout"}',
        '+   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","cat":"Sparky"}',
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run update
      await runDeploy(newConfig);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection MyNewCollection: updated",
        '-   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","dog":"Scout"}',
        '+   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","cat":"Sparky"}',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.collections);

      // Run remove with dryrun
      await runRemove(config, true);
      logs = [
        "(DryRun) FQL 10 schema removal in progress...",
        "(DryRun) Collection MyNewCollection: deleted",
        "(DryRun) FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema removal in progress...",
        "Collection MyNewCollection: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verifyNoCollections();
    });

    it("manages a collection with an index with terms", async () => {
      const config = {
        collections: {
          IndexWithTerms: {
            indexes: {
              byName: {
                terms: [{ field: "name" }],
              },
            },
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithTerms: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run update
      config.collections.IndexWithTerms.indexes.byName.terms = [
        { field: "pet_name" },
      ];
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithTerms: updated",
        '-   indexes: {"byName":{"terms":[{"field":"name"}],"queryable":true}}',
        '+   indexes: {"byName":{"terms":[{"field":"pet_name"}],"queryable":true}}',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema removal in progress...",
        "Collection IndexWithTerms: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verifyNoCollections();
    });

    it("manages a collection with an index with values", async () => {
      const config = {
        collections: {
          IndexWithValues: {
            indexes: {
              byName: {
                values: [{ field: "name" }],
              },
            },
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithValues: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run update
      config.collections.IndexWithValues.indexes.byName.values = [
        { field: "pet_name", order: "desc" },
      ];
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithValues: updated",
        '-   indexes: {"byName":{"values":[{"field":"name","order":"asc"}],"queryable":true}}',
        '+   indexes: {"byName":{"values":[{"field":"pet_name","order":"desc"}],"queryable":true}}',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema removal in progress...",
        "Collection IndexWithValues: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verifyNoCollections();
    });
  });

  it("manages a collection with constraints", async () => {
    const config = {
      collections: {
        CollectionWithConstraints: {
          constraints: [{ unique: ["name"] }],
        },
      },
    };

    // Run Create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Collection CollectionWithConstraints: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Run Noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Test Update
    config.collections.CollectionWithConstraints.constraints = [
      { unique: ["pet_name"] },
    ];
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Collection CollectionWithConstraints: updated",
      '-   constraints: [{"unique":["name"]}]',
      '+   constraints: [{"unique":["pet_name"]}]',
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema removal in progress...",
      "Collection CollectionWithConstraints: deleted",
      "FQL 10 schema removal complete",
    ];
    verifyLogs(logs);
    await verifyNoCollections();
  });
});
