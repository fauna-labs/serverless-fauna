const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const { verifyLogs, verifyCollections } = require("../utils/verify");

describe("FQL 10 Collections", () => {
  let client;
  const log = jest.fn();
  const logger = new Logger({ log });

  const verifyNoCollections = async () => {
    const actual = await client.query(fql`Collection.all().count()`);
    expect(actual.data).toEqual(0);
  };

  const runDeploy = async (config, preview = false) => {
    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
      options: { preview },
    });

    await cmd.deploy();
  };

  const runRemove = async (config, preview = false) => {
    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
      options: { preview },
    });

    await cmd.remove();
  };

  beforeAll(async () => {
    const p = clientConfig.port;
    const ep = `${clientConfig.scheme}://${clientConfig.domain}${
      p ? ":" + p : ""
    }`;
    client = new Client({
      secret: clientConfig.secret,
      endpoint: new URL(ep),
    });
    await cleanup(client);
  });

  beforeEach(async () => {
    await cleanup(client);
  });

  afterAll(async () => {
    client.close();
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

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL 10 schema update in progress...",
        "Collection: MyNewCollection created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run update
      const newConfig = {
        collections: {
          MyNewCollection: {
            data: { cat: "Sparky" },
          },
        },
      };
      await runDeploy(newConfig);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection: MyNewCollection updated",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, newConfig.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema remove in progress...",
        "Collection: MyNewCollection deleted",
        "FQL 10 schema remove complete",
      ];
      verifyLogs(log, logs);
      await verifyNoCollections();
    });

    it("manages a collection with an index with terms", async () => {
      const config = {
        collections: {
          IndexWithTerms: {
            indexes: {
              byName: {
                terms: [{ field: "name" }],
                queryable: true,
              },
            },
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL 10 schema update in progress...",
        "Collection: IndexWithTerms created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run update
      config.collections.IndexWithTerms.indexes.byName.terms = [
        { field: "pet_name" },
      ];
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection: IndexWithTerms updated",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema remove in progress...",
        "Collection: IndexWithTerms deleted",
        "FQL 10 schema remove complete",
      ];
      verifyLogs(log, logs);
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
        "Collection: IndexWithValues created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run update
      config.collections.IndexWithValues.indexes.byName.values = [
        { field: "pet_name", order: "desc" },
      ];
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection: IndexWithValues updated",
        "FQL 10 schema update complete",
      ];
      verifyLogs(log, logs);
      await verifyCollections(client, config.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema remove in progress...",
        "Collection: IndexWithValues deleted",
        "FQL 10 schema remove complete",
      ];
      verifyLogs(log, logs);
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
      "Collection: CollectionWithConstraints created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(log, logs);
    await verifyCollections(client, config.collections);

    // Run Noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(log, logs);
    await verifyCollections(client, config.collections);

    // Test Update
    config.collections.CollectionWithConstraints.constraints = [
      { unique: ["pet_name"] },
    ];
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Collection: CollectionWithConstraints updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(log, logs);
    await verifyCollections(client, config.collections);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema remove in progress...",
      "Collection: CollectionWithConstraints deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(log, logs);
    await verifyNoCollections();
  });
});
