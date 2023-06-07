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

  const runDeploy = async (config, preview = false) => {
    const cmd = new FQL10Commands({
      config,
      faunaClient: client,
      logger,
      options: { preview },
    });

    await cmd.deploy();
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

  it("creates a single function without data", async () => {
    const config = {
      functions: {
        NoData: {
          body: "_ => 1",
        },
      },
    };

    await runDeploy(config);

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

    await runDeploy(config);

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

    await runDeploy(config);

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

    await runDeploy(config);

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

    await runDeploy(config);
    log.mockClear();

    config.functions.ToUpdate.body = "_ => 'new'";
    config.functions.ToUpdate["role"] = "admin";
    config.functions.ToUpdate.data["new"] = "school";
    delete config.functions.ToUpdate.data.old;

    await runDeploy(config);

    const logs = [
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

    await runDeploy(config);
    log.mockClear();

    config.functions.ToUpdateNoData.body = "_ => 'new'";
    config.functions.ToUpdateNoData["role"] = "admin";
    await runDeploy(config);

    const logs = [
      "FQL 10 schema update in progress...",
      "Function: ToUpdateNoData updated",
      "FQL 10 schema update complete",
    ];
    await verifyLogs(log, logs);

    await verifyFunctions(client, config.functions);
  });
});