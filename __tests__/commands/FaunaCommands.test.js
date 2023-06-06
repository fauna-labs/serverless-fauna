const FQL10Commands = require("../../commands/FQL10Commands");
const FQL4DeployCommand = require("../../commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("../../commands/FQL4RemoveCommand");
const FaunaCommands = require("../../commands/FaunaCommands");

const { fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const getFql4Client = require("../../fauna/v4/client");
const getFqlxClient = require("../../fauna/v10/client");

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

  const cleanup = async () => {
    await fqlxClient.query(fql`Function.all().map(f => f.delete())`);
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
    await cleanup();
  });

  it("deploys all in expected order", async () => {
    await faunaCommands.deploy();

    const expectedLogs = [
      "FQL X schema create/update transaction in progress...",
      "Function: FQLXFunc created",
      "FQL X schema remove transactions in progress...",
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
      "FQL X schema remove transactions in progress...",
      "Function: FQLXFunc deleted",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fqlx", async () => {
    await faunaCommands.deployFqlx();

    const expectedLogs = [
      "FQL X schema create/update transaction in progress...",
      "Function: FQLXFunc created",
      "FQL X schema remove transactions in progress...",
    ];

    await verify(expectedLogs);
  });

  it("removes only fqlx", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommands.removeFqlx();
    const expectedLogs = [
      "FQL X schema remove transactions in progress...",
      "Function: FQLXFunc deleted",
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
