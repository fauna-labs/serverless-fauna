const FQL10Commands = require("../../commands/FQL10Commands");
const FQL4DeployCommand = require("../../commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("../../commands/FQL4RemoveCommand");
const FaunaCommands = require("../../commands/FaunaCommands");

const { fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const getFql4Client = require("../../fauna/v4/client");
const getFql10Client = require("../../fauna/v10/client");

describe("FaunaCommands", () => {
  let fql10Client;
  let fql4Client;
  const log = jest.fn();
  const logger = new Logger({ log });
  let faunaCommands, faunaCommandsV10Only, faunaCommandsV4Only;

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

    const fql10Commands = new FQL10Commands({
      config: fqlxConfig,
      faunaClient: fql10Client,
      logger,
    });

    const fql4DeployCommand = new FQL4DeployCommand({
      config: fql4Config,
      faunaClient: fql4Client,
      logger,
    });

    const fql4RemoveCommand = new FQL4RemoveCommand({
      config: fql4Config,
      faunaClient: fql4Client,
      logger,
    });

    faunaCommands = new FaunaCommands({
      config: {
        fauna: { ...fql4Config },
        fauna_v10: { ...fqlxConfig },
      },
      deployCommands: [fql10Commands, fql4DeployCommand],
      removeCommands: [fql4RemoveCommand, fql10Commands],
    });

    faunaCommandsV10Only = new FaunaCommands({
      config: {
        fauna: { ...fql4Config },
        fauna_v10: { ...fqlxConfig },
      },
      deployCommands: [fql10Commands, fql4DeployCommand],
      removeCommands: [fql4RemoveCommand, fql10Commands],
      options: { "schema-version": "10" },
    });

    faunaCommandsV4Only = new FaunaCommands({
      config: {
        fauna: { ...fql4Config },
        fauna_v10: { ...fqlxConfig },
      },
      deployCommands: [fql10Commands, fql4DeployCommand],
      removeCommands: [fql4RemoveCommand, fql10Commands],
      options: { "schema-version": "4" },
    });
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    fql10Client.close();
    fql4Client.close();
  });

  it("deploys all in expected order", async () => {
    await faunaCommands.deploy();

    const expectedLogs = [
      "FQL 10 schema update in progress...",
      "Function FQLXFunc: created",
      "FQL 10 schema update complete",
      "FQL 4 schema update in progress...",
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
      "FQL 10 schema remove in progress...",
      "Function FQLXFunc: deleted",
      "FQL 10 schema remove complete",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fql10", async () => {
    await faunaCommandsV10Only.deploy();

    const expectedLogs = [
      "FQL 10 schema update in progress...",
      "Function FQLXFunc: created",
      "FQL 10 schema update complete",
    ];

    await verify(expectedLogs);
  });

  it("removes only fql10", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommandsV10Only.remove();
    const expectedLogs = [
      "FQL 10 schema remove in progress...",
      "Function FQLXFunc: deleted",
      "FQL 10 schema remove complete",
    ];

    await verify(expectedLogs);
  });

  it("deploys only fql4", async () => {
    await faunaCommandsV4Only.deploy();

    const expectedLogs = [
      "FQL 4 schema update in progress...",
      "function `FQL4Func` was created",
    ];

    await verify(expectedLogs);
  });

  it("removes only fql4", async () => {
    await faunaCommands.deploy();
    log.mockClear();
    await faunaCommandsV4Only.remove();
    const expectedLogs = ['Resource Function("FQL4Func") deleted'];

    await verify(expectedLogs);
  });
});
