const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const { objToArray, mergeDefaultMetadata } = require("../utils/objects");

describe("FQL10_Functions", () => {
  let faunaClient;
  const log = jest.fn();
  const logger = new Logger({ log });

  const verifyNoFunctions = async () => {
    const actual = await faunaClient.query(fql`Function.all().count()`);
    expect(actual.data).toEqual(0);
  };

  const verifyLogs = (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
    log.mockClear();
  };

  const verify = async (funcs) => {
    funcs = objToArray(funcs);
    funcs = funcs
      .map(mergeDefaultMetadata)
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    const actual = await faunaClient.query(
      fql`Function.all().order( .name ).toArray()`
    );
    if (funcs.length !== actual.data.length) {
      expect(actual.data).toEqual(funcs);
    }

    for (let i = 0; i < funcs.length; i++) {
      const e = funcs[i];
      const a = actual.data[i];

      expect(a.data).toEqual(e.data);
      expect(a.name).toEqual(e.name);
      expect(a.body).toEqual(e.body);
      expect(a.role).toEqual(e.role);
    }
  };

  const runDeploy = async (config, preview = false) => {
    const cmd = new FQL10Commands({
      config,
      faunaClient,
      logger,
      options: { preview },
    });

    await cmd.deploy();
  };

  const runRemove = async (config, preview = false) => {
    const cmd = new FQL10Commands({
      config,
      faunaClient,
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
    faunaClient = new Client({
      secret: clientConfig.secret,
      endpoint: new URL(ep),
    });
    await cleanup(faunaClient);
  });

  beforeEach(async () => {
    await cleanup(faunaClient);
  });

  afterAll(async () => {
    faunaClient.close();
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

  it("manages a function", async () => {
    const config = {
      functions: {
        SimpleFunction: {
          body: "_ => 1",
        },
      },
    };

    // Run create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Function SimpleFunction: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run update
    config.functions.SimpleFunction.body = "_ => 2";
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Function SimpleFunction: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema remove in progress...",
      "Function SimpleFunction: deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(logs);
    await verifyNoFunctions();
  });

  it("manages a function with data", async () => {
    const config = {
      functions: {
        WithData: {
          body: "_ => 1",
          data: {
            extra: "Extra",
          },
        },
      },
    };

    // Run create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Function WithData: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run update
    delete config.functions.WithData.data.extra;
    config.functions.WithData.data.extraextra = "Extra";

    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Function WithData: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema remove in progress...",
      "Function WithData: deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(logs);
    await verifyNoFunctions();
  });

  it("manages a function with a role", async () => {
    const config = {
      functions: {
        WithRole: {
          body: "_ => 1",
          role: "server",
        },
      },
    };

    // run create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Function WithRole: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // run noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // run update
    config.functions.WithRole.role = "admin";
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Function WithRole: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema remove in progress...",
      "Function WithRole: deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(logs);
    await verifyNoFunctions();
  });

  it("manages several functions", async () => {
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

    // run create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Function WithServerRole: created",
      "Function WithAdminRole: created",
      "Function DoubleData: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // run noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // run update
    config.functions.DoubleData.data.how = "numerous";
    config.functions.WithAdminRole.data = { updated_by: "unit test" };
    config.functions.WithAdminRole.body = "_ => 4";
    config.functions.WithServerRole.body = "_ => 5";
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Function WithServerRole: updated",
      "Function WithAdminRole: updated",
      "Function DoubleData: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.functions);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema remove in progress...",
      "Function DoubleData: deleted",
      "Function WithAdminRole: deleted",
      "Function WithServerRole: deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(logs);
    await verifyNoFunctions();
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

    await runDeploy(config);
    log.mockClear();

    delete config.functions.NestedUpdate.data.nest.eggs;

    await runDeploy(config);
    const logs = [
      "FQL 10 schema update in progress...",
      "Function NestedUpdate: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);

    await verify(config.functions);
  });

  it("ignores resources managed by FQL 4 plugin", async () => {
    // Create a few functions
    await faunaClient.query(
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

    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Function Managed: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);

    const existing = await faunaClient.query(fql`Function.all().map( .name )`);
    const expected = ["Managed", "V4Like1", "V4Like2"];
    expect(existing.data.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data.data).toContain(e);
    }
  });

  it("upgrades a resource be managed by the FQL 10 command", async () => {
    // Create a few functions
    await faunaClient.query(
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

    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Function Unmanaged: updated",
      "Function V4Like1: updated",
      "Function V4Like2: updated",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);

    delete config.functions.V4Like2;

    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Function V4Like2: deleted",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);

    await verify(config.functions);
  });

  it("handles a reasonably sized config", async () => {
    const num = 100;
    const { config, names } = prepareNFunctions(num);
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      ...names.map((n) => `Function ${n}: created`),
      "FQL 10 schema update complete",
    ];

    verifyLogs(logs);

    let res = await faunaClient.query(
      fql`Function.all().toArray().map( .name )`
    );
    expect(res.data.length).toEqual(num);
  });

  it("removes only `fauna:v10` functions", async () => {
    // Create a few functions
    await faunaClient.query(
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

    await runDeploy(config);
    log.mockClear();

    delete config.functions.Managed2;
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Function Managed2: deleted",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);

    const existing = await faunaClient.query(
      fql`Function.all().toArray().map( .name )`
    );
    const expected = ["Managed1", "Unmanaged", "V4Like1", "V4Like2"];
    expect(existing.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data).toContain(e);
    }
  });

  it("deploy removes functions not present in config", async () => {
    const num = 50;
    const { config, names } = prepareNFunctions(num);
    await runDeploy(config);
    log.mockClear();

    const firstKv = Object.entries(config.functions)[0];
    const nextConfig = { functions: {} };
    nextConfig.functions[firstKv[0]] = firstKv[1];

    await runDeploy(nextConfig);
    const logs = [
      "FQL 10 schema update in progress...",
      ...names.slice(1).map((n) => `Function ${n}: deleted`),
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(nextConfig.functions);
  });

  it("removes only `fauna:v10` functions with remove command", async () => {
    // Create a few functions
    await faunaClient.query(
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

    await runDeploy(config);
    log.mockClear();

    await runRemove(config);
    const logs = [
      "FQL 10 schema remove in progress...",
      "Function Managed1: deleted",
      "Function Managed2: deleted",
      "FQL 10 schema remove complete",
    ];
    verifyLogs(logs);

    const existing = await faunaClient.query(
      fql`Function.all().toArray().map( .name )`
    );
    const expected = ["Unmanaged", "V4Like1", "V4Like2"];
    expect(existing.data.length).toEqual(expected.length);
    for (const e of expected) {
      expect(existing.data).toContain(e);
    }
  });
});
