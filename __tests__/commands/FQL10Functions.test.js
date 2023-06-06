const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const { verifyFunctions, verifyLogs } = require("../utils/verify");

describe("FQL 10 Functions", () => {
  let client;
  const log = jest.fn();
  const logger = new Logger({ log });

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

  const prepareNFunctions = (n) => {
    const config = { functions: {} };
    const names = [];

    for (let i = 1; i <= n; i++) {
      const f = `Func${i < 10 ? "0" + i : i}`;
      config.functions[f] = { body: `_ => ${i}` };
      names.push(f);
    }
    return { config, names };
  };

  it("creates a single function without data", async () => {
    const config = {
      functions: {
        NoData: {
          body: "_ => 1",
        },
      },
    };

    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: NoData created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("creates a single function without role", async () => {
    const config = {
      functions: {
        NoRole: {
          body: "_ => 1",
          data: {
            extra: "Extra",
          },
        },
      },
    };

    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: NoRole created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("creates single function with a role", async () => {
    const config = {
      functions: {
        WithRole: {
          body: "_ => 1",
          role: "server",
          data: {
            extra: "Extra",
          },
        },
      },
    };

    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: WithRole created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("creates many functions with different properties", async () => {
    const config = {
      functions: {
        WithServerRole: {
          body: "_ => 1",
          role: "server",
          data: {
            extra: "Extra",
          },
        },
        WithAdminRole: {
          body: "_ => 2",
          role: "admin",
          data: {
            quite: "minty",
          },
        },
        DoubleData: {
          body: "_ => 3",
          data: {
            much: "data",
            many: "property",
          },
        },
      },
    };

    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: WithServerRole created",
      "Function: WithAdminRole created",
      "Function: DoubleData created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("updates a function body and data", async () => {
    const config = {
      functions: {
        ToUpdate: {
          body: "_ => 1",
          data: {
            old: "school",
          },
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    config.functions.ToUpdate.body = "_ => 'new'";
    config.functions.ToUpdate["role"] = "admin";
    config.functions.ToUpdate.data["new"] = "school";
    delete config.functions.ToUpdate.data.old;

    new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: ToUpdate created",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Function: ToUpdate updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("updates a function without data", async () => {
    const config = {
      functions: {
        ToUpdateNoData: {
          body: "_ => 1",
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    config.functions.ToUpdateNoData.body = "_ => 'new'";
    config.functions.ToUpdateNoData["role"] = "admin";

    new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: ToUpdateNoData created",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Function: ToUpdateNoData updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("removes nested data", async () => {
    const config = {
      functions: {
        NestedUpdate: {
          body: "_ => 1",
          data: {
            nest: {
              eggs: 1,
            },
          },
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    delete config.functions.NestedUpdate.data.nest.eggs;

    new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: NestedUpdate created",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Function: NestedUpdate updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    delete config.functions.NestedUpdate.data.nest.eggs;
    await verifyFunctions(client, config.functions);
  });

  it("ignores resources managed by FQL 4 plugin", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }}),
      ]`
    );

    const config = {
      functions: {
        Managed: {
          body: "_ => 'managed'",
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: Managed created",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await client.query(fql`Function.all().map( .name )`);
    const expected = ["Managed", "V4Like1", "V4Like2"];
    expect(existing.data.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data.data).toContain(e);
    }
  });

  it("upgrades a resource be managed by the FQL X command", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }})
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
        V4Like2: {
          body: "_ => 'v4like2'",
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    delete config.functions.V4Like2;
    new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: Unmanaged updated",
      "Function: V4Like1 updated",
      "Function: V4Like2 updated",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Function: V4Like2 deleted",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });

  it("handles a reasonably sized config", async () => {
    const num = 50;
    const { config, names } = prepareNFunctions(num);

    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();
    const logs = [
      "FQL 10 schema update in progress...",
      ...names.map((n) => `Function: ${n} created`),
      "FQL 10 schema update complete",
    ];

    await verifyLogs(log, logs);

    const existing = [];
    let res = await client.query(fql`Function.all().map( .name )`);
    existing.push(...(res.data.data ?? []));
    let after = res.data.after;
    while (after != null) {
      res = await client.query(fql`Set.paginate(${after})`);
      existing.push(...(res.data.data ?? []));
      after = res.data.after;
    }

    expect(existing.length).toEqual(num);
  });

  it("removes only `fauna:v10` functions", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }})
      ]`
    );

    const config = {
      functions: {
        Managed1: {
          body: "_ => 1",
        },
        Managed2: {
          body: "_ => 1",
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    delete config.functions.Managed2;
    new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: Managed1 created",
      "Function: Managed2 created",
      "FQL 10 schema update complete",
      "FQL 10 schema update in progress...",
      "Function: Managed2 deleted",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    const existing = await client.query(fql`Function.all().map( .name )`);
    const expected = ["Managed1", "Unmanaged", "V4Like1", "V4Like2"];
    expect(existing.data.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data.data).toContain(e);
    }
  });

  it("removes all `fauna:v10` functions with pagination", async () => {
    const num = 50;
    const { config, names } = prepareNFunctions(num);

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();
    let logs = [
      "FQL 10 schema update in progress...",
      ...names.map((n) => `Function: ${n} created`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    log.mockClear();

    const firstKv = Object.entries(config.functions)[0];
    const nextConfig = { functions: {} };
    nextConfig.functions[firstKv[0]] = firstKv[1];

    cmd = new FQL10Commands({
      config: nextConfig,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();

    logs = [
      "FQL 10 schema update in progress...",
      ...names.slice(1).map((n) => `Function: ${n} deleted`),
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);
    await verifyFunctions(client, nextConfig.functions);
  });

  it("removes only `fauna:v10` functions with remove command", async () => {
    // Create a few functions
    await client.query(
      fql`[
        Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
        Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
        Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }})
      ]`
    );

    const config = {
      functions: {
        Managed1: {
          body: "_ => 1",
        },
        Managed2: {
          body: "_ => 1",
        },
      },
    };

    let cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
    });

    await cmd.deploy();
    await cmd.remove();

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: Managed1 created",
      "Function: Managed2 created",
      "FQL 10 schema update complete",
      "FQL 10 schema remove in progress...",
      "Function: Managed1 deleted",
      "Function: Managed2 deleted",
      "FQL 10 schema remove complete",
    ];
    await verifyLogs(log, logs);

    const existing = await client.query(fql`Function.all().map( .name )`);
    const expected = ["Unmanaged", "V4Like1", "V4Like2"];
    expect(existing.data.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data.data).toContain(e);
    }
  });
});
