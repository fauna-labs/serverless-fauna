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

describe("FaunaCommands", () => {
  let fqlxClient;
  let fql4Client;
  const log = jest.fn();
  const logger = new Logger({ log });
  let fqlxCommands, fql4DeployCommand, fql4RemoveCommand, faunaCommands;

  const fqlxConfig = {
    functions: {
      FQLXFunc: {
        body: "_ => 1",
      },
    },
  };

  const fql4Config = {
    functions: {
      FQL4Func: {
        name: "FQL4Func",
        body: "Lambda('x', Var('x'))",
      },
    },
  };

  const verify = async (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
  };

  beforeAll(async () => {
    fql4Client = getFql4Client(clientConfig);
    fqlxClient = getFqlxClient(clientConfig);

    fqlxCommands = new FQL10Commands({
      config: fqlxConfig,
      faunaClient: fqlxClient,
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

    faunaCommands = new FaunaCommands(
      {
        fauna: { ...fql4Config },
        fqlx: { ...fqlxConfig },
      },
      [fqlxCommands, fql4DeployCommand],
      [fql4RemoveCommand, fqlxCommands]
    );
  });

  beforeEach(async () => {
    await cleanup(fqlxClient);
  });

  afterAll(async () => {
    fql4Client.close();
    fqlxClient.close();
  });

  it("deploys all in expected order", async () => {
    await faunaCommands.deploy();

    const expectedLogs = [
      "FQL v10 schema update in progress...",
      "Function: FQLXFunc created",
      "FQL v10 schema update complete",
      "Schema updating in process...",
      "function `FQL4Func` was created",
    ];

    await verify(expectedLogs);
  });

  it("removes all in expected order", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommands.remove();
    const expectedLogs = [
      'Resource Function("FQL4Func") deleted',
      "FQL v10 schema remove in progress...",
      "Function: FQLXFunc deleted",
      "FQL v10 schema remove complete",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fqlx", async () => {
    await faunaCommands.deployFqlx();

    const expectedLogs = [
      "FQL v10 schema update in progress...",
      "Function: FQLXFunc created",
      "FQL v10 schema update complete",
    ];

    await verify(expectedLogs);
  });

  it("removes only fqlx", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommands.removeFqlx();
    const expectedLogs = [
      "FQL v10 schema remove in progress...",
      "Function: FQLXFunc deleted",
      "FQL v10 schema remove complete",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fql4", async () => {
    await faunaCommands.deployFql4();

    const expectedLogs = [
      "Schema updating in process...",
      "function `FQL4Func` was created",
    ];

    await verify(expectedLogs);
  });

  it("removes only fql4", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommands.removeFql4();
    const expectedLogs = ['Resource Function("FQL4Func") deleted'];

    await verify(expectedLogs);
  });
});
