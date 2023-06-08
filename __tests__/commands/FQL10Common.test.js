const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const {
  verifyFunctions,
  verifyLogs,
  verifyCollections,
  verifyRoles,
} = require("../utils/verify");

describe("FQL 10 Common", () => {
  let client;
  const log = jest.fn();
  const logger = new Logger({ log });

  const getExistingResourceNames = async () => {
    const res = await client.query(fql`
    let colls = Collection.all().toArray().map( .name )
    let funcs = Function.all().toArray().map( .name )
    let roles = Role.all().toArray().map( .name )
    colls.concat(funcs).concat(roles)
    `);
    return res.data;
  };

  const prepareNOfEachResource = (n) => {
    const config = { functions: {}, collections: {}, roles: {} };
    const names = {
      functions: [],
      collections: [],
      roles: [],
    };

    const pad = (i) => {
      if (i < 10) {
        return "00" + i;
      } else if (i < 100) {
        return "0" + i;
      } else {
        return `${i}`;
      }
    };

    for (let i = 1; i <= n; i++) {
      const f = `Func${pad(i)}`;
      config.functions[f] = { body: `_ => ${i}` };
      names.functions.push(f);

      const c = `Coll${pad(i)}`;
      config.collections[c] = {};
      names.collections.push(c);

      const r = `Role${pad(i)}`;
      config.roles[r] = {};
      names.roles.push(r);
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
      query_timeout_ms: 10_000,
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
      roles: {
        NestedUpdateRole: {
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
    delete config.roles.NestedUpdateRole.data.nest.eggs;
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: NestedUpdateColl updated",
      "Function: NestedUpdateFunc updated",
      "Role: NestedUpdateRole updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    await verifyFunctions(client, config.functions);
    await verifyCollections(client, config.collections);
    await verifyRoles(client, config.roles);
  });

  it("ignores resources managed by FQL 4 plugin", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "FunctionV4", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Collection.create({ name: "CollectionV4", data: { created_by_serverless_plugin: true }}),
        Role.create({ name: "RoleV4", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      functions: {
        FunctionV10: {
          body: "_ => 'managed'",
        },
      },
      collections: {
        CollectionV10: {},
      },
      roles: {
        RoleV10: {},
      },
    };

    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: CollectionV10 created",
      "Function: FunctionV10 created",
      "Role: RoleV10 created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = [
      "CollectionV10",
      "CollectionV4",
      "FunctionV10",
      "FunctionV4",
      "RoleV10",
      "RoleV4",
    ];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });

  it("upgrades a resource to be managed by the FQL v10 plugin", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Collection.create({ name: "CollectionUnmanaged"}),
        Collection.create({ name: "CollectionV4", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "FunctionUnmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "FunctionV4", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Role.create({ name: "RoleUnmanaged"}),
        Role.create({ name: "RoleV4", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      functions: {
        FunctionUnmanaged: {
          body: "_ => 'unmanaged'",
        },
        FunctionV4: {
          body: "_ => 'v4like1'",
        },
      },
      collections: {
        CollectionUnmanaged: {},
        CollectionV4: {},
      },
      roles: {
        RoleUnmanaged: {},
        RoleV4: {},
      },
    };

    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Collection: CollectionUnmanaged updated",
      "Collection: CollectionV4 updated",
      "Function: FunctionUnmanaged updated",
      "Function: FunctionV4 updated",
      "Role: RoleUnmanaged updated",
      "Role: RoleV4 updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    delete config.functions.FunctionV4;
    delete config.collections.CollectionUnmanaged;
    delete config.roles.RoleV4;
    await runDeploy(config);

    logs = [
      "FQL 10 schema update in progress...",
      "Collection: CollectionUnmanaged deleted",
      "Function: FunctionV4 deleted",
      "Role: RoleV4 deleted",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
    await verifyCollections(client, config.collections);
    await verifyRoles(client, config.roles);
  });

  it("handles a reasonably sized config", async () => {
    const num = 100;
    const { config, names } = prepareNOfEachResource(num);

    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.map((n) => `Collection: ${n} created`),
      ...names.functions.map((n) => `Function: ${n} created`),
      ...names.roles.map((n) => `Role: ${n} created`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    expect(existing.length).toEqual(
      Object.values(names).reduce((p, c) => p + c.length, 0)
    );
  }, 10_000);

  it("deploy removes only `fauna:v10` resources", async () => {
    await client.query(
      fql`[
        Collection.create({ name: "CollectionUnmanaged"}),
        Collection.create({ name: "CollectionV4", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "FunctionUnmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "FunctionV4", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Role.create({ name: "RoleUnmanaged"}),
        Role.create({ name: "RoleV4", data: { created_by_serverless_plugin: true }}),
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
      roles: {
        Role1: {},
        Role2: {},
      },
    };

    await runDeploy(config);
    log.mockClear();

    delete config.collections.Coll2;
    delete config.functions.Func2;
    delete config.roles.Role2;
    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      "Collection: Coll2 deleted",
      "Function: Func2 deleted",
      "Role: Role2 deleted",
      "FQL 10 schema update complete",
    ];
    verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = [
      "CollectionUnmanaged",
      "CollectionV4",
      "Coll1",
      "FunctionUnmanaged",
      "FunctionV4",
      "Func1",
      "RoleUnmanaged",
      "RoleV4",
      "Role1",
    ];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });

  it("deploy removes many `fauna:v10` resources", async () => {
    const num = 100;
    const { config, names } = prepareNOfEachResource(num);

    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.map((n) => `Collection: ${n} created`),
      ...names.functions.map((n) => `Function: ${n} created`),
      ...names.roles.map((n) => `Role: ${n} created`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    log.mockClear();

    const firstFunc = Object.entries(config.functions)[0];
    const firstColl = Object.entries(config.collections)[0];
    const firstRole = Object.entries(config.roles)[0];

    const nextConfig = { functions: {}, collections: {}, roles: {} };
    nextConfig.functions[firstFunc[0]] = firstFunc[1];
    nextConfig.collections[firstColl[0]] = firstColl[1];
    nextConfig.roles[firstRole[0]] = firstRole[1];

    await runDeploy(nextConfig);

    logs = [
      "FQL 10 schema update in progress...",
      ...names.collections.slice(1).map((n) => `Collection: ${n} deleted`),
      ...names.functions.slice(1).map((n) => `Function: ${n} deleted`),
      ...names.roles.slice(1).map((n) => `Role: ${n} deleted`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    await verifyFunctions(client, nextConfig.functions);
    await verifyCollections(client, nextConfig.collections);
    await verifyRoles(client, nextConfig.roles);
  }, 10_000);

  it("removes only `fauna:v10` resources with remove command", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Collection.create({ name: "CollectionUnmanaged"}),
        Collection.create({ name: "CollectionV4", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "FunctionUnmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "FunctionV4", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Role.create({ name: "RoleUnmanaged"}),
        Role.create({ name: "RoleV4", data: { created_by_serverless_plugin: true }}),
      ]`
    );

    const config = {
      collections: {
        CollectionV10: {},
      },
      functions: {
        FunctionV10: {
          body: "_ => 1",
        },
      },
      roles: {
        RoleV10: {},
      },
    };

    await runDeploy(config);
    log.mockClear();
    await runRemove(config);

    const logs = [
      "FQL 10 schema remove in progress...",
      "Collection: CollectionV10 deleted",
      "Function: FunctionV10 deleted",
      "Role: RoleV10 deleted",
      "FQL 10 schema remove complete",
    ];
    await verifyLogs(log, logs);

    const existing = await getExistingResourceNames();
    const expected = [
      "CollectionUnmanaged",
      "CollectionV4",
      "FunctionUnmanaged",
      "FunctionV4",
      "RoleUnmanaged",
      "RoleV4",
    ];
    expect(existing.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing).toContain(e);
    }
  });
});
