const FQL10Commands = require("../../commands/FQL10Commands");
const FQL4DeployCommand = require("../../commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("../../commands/FQL4RemoveCommand");
const FaunaCommands = require("../../commands/FaunaCommands");

const { fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const getFql4Client = require("../../fauna/v4/client");
const getFqlxClient = require("../../fauna/v10/client");
const { cleanup } = require("../utils/cleanup");
const { verifyLogs } = require("../utils/verify");

describe("FaunaCommands", () => {
  let fql10Client;
  let fql4Client;
  const log = jest.fn();
  const logger = new Logger({ log });
  let fql10Commands, fql4DeployCommand, fql4RemoveCommand;

  const fql10Config = {
    functions: {
      FQLv10Func: {
        body: "_ => 1",
      },
    },
  };

  const fql4Config = {
    functions: {
      FQLv4Func: {
        name: "FQLv4Func",
        body: "Lambda('x', Var('x'))",
      },
    },
  };

  beforeAll(async () => {
    fql4Client = getFql4Client(clientConfig);
    fql10Client = getFqlxClient(clientConfig);

    fql10Commands = new FQL10Commands({
      config: fql10Config,
      faunaClient: fql10Client,
      logger,
    });

    fql4DeployCommand = new FQL4DeployCommand({
      config: fql4Config,
      faunaClient: fql4Client,
      logger,
    });

    fql4RemoveCommand = new FQL4RemoveCommand({
      config: fql4Config,
      faunaClient: fql4Client,
      logger,
    });
  });

  beforeEach(async () => {
    await cleanup(fql10Client);
  });

  afterAll(async () => {
    fql4Client.close();
    fql10Client.close();
  });

  it("deploys and removes fql v10", async () => {
    const faunaCommands = new FaunaCommands({
      deployCommand: fql10Commands,
      removeCommand: fql10Commands,
    });

    // Run deploy
    await faunaCommands.deploy();
    let expectedLogs = [
      "FQL v10 schema update in progress...",
      "Function: FQLv10Func created",
      "FQL v10 schema update complete",
    ];
    await verifyLogs(log, expectedLogs);

    // Run remove
    await faunaCommands.remove();
    expectedLogs = [
      "FQL v10 schema remove in progress...",
      "Function: FQLv10Func deleted",
      "FQL v10 schema remove complete",
    ];
    await verifyLogs(log, expectedLogs);
  });

  it("deploys and removes fql v4", async () => {
    const faunaCommands = new FaunaCommands({
      deployCommand: fql4DeployCommand,
      removeCommand: fql4RemoveCommand,
    });

    // Run deploy
    await faunaCommands.deploy();
    let expectedLogs = [
      "FQL v4 schema update in progress...",
      "function `FQLv4Func` was created",
    ];
    await verifyLogs(log, expectedLogs);

    // Run remove
    await faunaCommands.remove();
    expectedLogs = ['Resource Function("FQLv4Func") deleted'];
    await verifyLogs(log, expectedLogs);
  });
});
