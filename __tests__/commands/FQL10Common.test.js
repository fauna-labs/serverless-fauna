const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const {
  verifyFunctions,
  verifyLogs,
  verifyCollections,
} = require("../utils/verify");

describe("FQL 10 Common", () => {
  let client;
  const log = jest.fn();
  const logger = new Logger({ log });

  const getExistingResourceNames = async () => {
    const res = await client.query(fql`
    let colls = Collection.all().toArray().map( .name )
    let funcs = Function.all().toArray().map( .name )
    colls.concat(funcs)
    `);
    return res.data;
  };

  const prepareNResources = (n) => {
    const config = { functions: {}, collections: {} };
    const names = {
      functions: [],
      collections: [],
    };

    for (let i = 1; i <= n; i++) {
      const padded = `${i < 10 ? "0" + i : i}`;

      const f = `Func${padded}`;
      config.functions[f] = { body: `_ => ${i}` };
      names.functions.push(f);

      const c = `Coll${padded}`;
      config.collections[c] = {};
      names.collections.push(c);
    }
    return { config, names };
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

  it("removes nested data", async () => {
    const config = {
      functions: {
        NestedUpdateFunc: {
          body: "_ => 1",
          data: {
            nest: {
              eggs: 1,
            },
          },
        },
      },
      collections: {
        NestedUpdateColl: {
          data: {
            nest: {
              eggs: 1,
            },
          },
        },
      },
    };

    await runDeploy(config);
    log.mockClear();

    delete config.functions.NestedUpdateFunc.data.nest.eggs;
    delete config.collections.NestedUpdateColl.data.nest.eggs;
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: NestedUpdateColl updated",
      "Function: NestedUpdateFunc updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    await verifyFunctions(client, config.functions);
    await verifyCollections(client, config.collections);
  });

  it("ignores resources managed by FQL 4 plugin", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Collection.create({ name: "V4Like1Coll", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      functions: {
        Managed: {
          body: "_ => 'managed'",
        },
      },
      collections: {
        ManagedColl: {},
      },
    };

    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: ManagedColl created",
      "Function: Managed created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = ["ManagedColl", "V4Like1Coll", "Managed", "V4Like1"];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });

  it("upgrades a resource be managed by the FQL v10 plugin", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Collection.create({ name: "UnmanagedColl"}),
        Collection.create({ name: "V4Like1Coll", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      functions: {
        Unmanaged: {
          body: "_ => 'unmanaged'",
        },
        V4Like1: {
          body: "_ => 'v4like1'",
        },
      },
      collections: {
        UnmanagedColl: {},
        V4Like1Coll: {},
      },
    };

    await runDeploy(config);

    delete config.functions.V4Like1;
    delete config.collections.UnmanagedColl;
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: UnmanagedColl updated",
      "Collection: V4Like1Coll updated",
      "Function: Unmanaged updated",
      "Function: V4Like1 updated",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Collection: UnmanagedColl deleted",
      "Function: V4Like1 deleted",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
    await verifyCollections(client, config.collections);
  });

  it("handles a reasonably sized config", async () => {
    const num = 50;
    const { config, names } = prepareNResources(num);

    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.map((n) => `Collection: ${n} created`),
      ...names.functions.map((n) => `Function: ${n} created`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    expect(existing.length).toEqual(
      Object.values(names).reduce((p, c) => p + c.length, 0)
    );
  });

  it("deploy removes only `fauna:v10` resources", async () => {
    await client.query(
      fql`[
        Collection.create({ name: "UnmanagedColl"}),
        Collection.create({ name: "V4Like1Coll", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      functions: {
        Func1: {
          body: "_ => 1",
        },
        Func2: {
          body: "_ => 1",
        },
      },
      collections: {
        Coll1: {},
        Coll2: {},
      },
    };

    await runDeploy(config);
    log.mockClear();

    delete config.collections.Coll2;
    delete config.functions.Func2;
    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: Coll2 deleted",
      "Function: Func2 deleted",
      "FQL 10 schema update complete",
    ];
    verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = [
      "UnmanagedColl",
      "V4Like1Coll",
      "Coll1",
      "Unmanaged",
      "V4Like1",
      "Func1",
    ];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });

  it("deploy removes many `fauna:v10` resources", async () => {
    const num = 50;
    const { config, names } = prepareNResources(num);

    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.map((n) => `Collection: ${n} created`),
      ...names.functions.map((n) => `Function: ${n} created`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    log.mockClear();

    const firstFunc = Object.entries(config.functions)[0];
    const firstColl = Object.entries(config.collections)[0];
    const nextConfig = { functions: {}, collections: {} };
    nextConfig.functions[firstFunc[0]] = firstFunc[1];
    nextConfig.collections[firstColl[0]] = firstColl[1];

    await runDeploy(nextConfig);

    logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.slice(1).map((n) => `Collection: ${n} deleted`),
      ...names.functions.slice(1).map((n) => `Function: ${n} deleted`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    await verifyFunctions(client, nextConfig.functions);
    await verifyCollections(client, nextConfig.collections);
  });

  it("removes only `fauna:v10` resources with remove command", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Collection.create({ name: "UnmanagedColl"}),
        Collection.create({ name: "V4Like1Coll", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      collections: {
        Managed2: {},
      },
      functions: {
        Managed1: {
          body: "_ => 1",
        },
      },
    };

    await runDeploy(config);
    log.mockClear();
    await runRemove(config);

    const logs = [
      "FQL 10 schema remove in progress...",
      "Collection: Managed2 deleted",
      "Function: Managed1 deleted",
      "FQL 10 schema remove complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = ["UnmanagedColl", "V4Like1Coll", "Unmanaged", "V4Like1"];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });
});
