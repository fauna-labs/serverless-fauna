const FQLXCommands = require("../../commands/FQLXCommands");
const FQL4DeployCommand = require("../../commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("../../commands/FQL4RemoveCommand");
const FaunaCommands = require("../../commands/FaunaCommands");

const { fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const getFql4Client = require("../../fauna/client");
const getFql10Client = require("../../fqlx/client");

describe("FaunaCommands", () => {
  let fql10Client;
  let fql4Client;
  const log = jest.fn();
  const logger = new Logger({ log });
  let fql10Commands, fql4DeployCommand, fql4RemoveCommand, faunaCommands;

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
    await fql10Client.query(fql`Function.all().map(f => f.delete())`);
  };

  const verify = async (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
  };

  beforeAll(async () => {
    fql4Client = getFql4Client(clientConfig);
    fql10Client = getFql10Client(clientConfig);

    fql10Commands = new FQLXCommands({
      config: fqlxConfig,
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

    faunaCommands = new FaunaCommands(
      {
        fauna: { ...fql4Config },
        fql10: { ...fqlxConfig },
      },
      [fql10Commands, fql4DeployCommand],
      [fql4RemoveCommand, fql10Commands]
    );
  });

  beforeEach(async () => {
    await cleanup();
  });

  it("deploys all in expected order", async () => {
    await faunaCommands.deploy();

    const expectedLogs = [
      "FQL 10 schema update in progress...",
      "Function FQLXFunc: created",
      "Schema update complete",
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
      "FQL 10 schema removal in progress...",
      "Function FQLXFunc: deleted",
      "Schema removal complete",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fql10", async () => {
    await faunaCommands.deployFql10();

    const expectedLogs = [
      "FQL 10 schema update in progress...",
      "Function FQLXFunc: created",
      "Schema update complete",
    ];

    await verify(expectedLogs);
  });

  it("removes only fql10", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommands.removeFql10();
    const expectedLogs = [
      "FQL 10 schema removal in progress...",
      "Function FQLXFunc: deleted",
      "Schema removal complete",
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
