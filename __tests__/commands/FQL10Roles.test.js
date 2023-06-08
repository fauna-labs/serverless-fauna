const FQL10Commands = require("../../commands/FQL10Commands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { cleanup } = require("../utils/cleanup");
const { verifyRoles, verifyLogs } = require("../utils/verify");

describe("FQL 10 Roles", () => {
  let client;
  const log = jest.fn();
  const logger = new Logger({ log });

  const verifyNoRoles = async () => {
    const actual = await client.query(fql`Role.all().count()`);
    expect(actual.data).toEqual(0);
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

  describe("role create / update / remove", () => {
    it("manages a role with data", async () => {
      const config = {
        roles: {
          MyRole: {
            data: { dog: "Scout" },
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL v10 schema update in progress...",
        "Role: MyRole created",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL v10 schema update in progress...",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run update
      const newConfig = {
        roles: {
          MyRole: {
            data: { cat: "Sparky" },
          },
        },
      };
      await runDeploy(newConfig);
      logs = [
        "FQL v10 schema update in progress...",
        "Role: MyRole updated",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, newConfig.roles);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL v10 schema remove in progress...",
        "Role: MyRole deleted",
        "FQL v10 schema remove complete",
      ];
      await verifyLogs(log, logs);
      await verifyNoRoles();
    });

    it("manages a role with privileges", async () => {
      const config = {
        collections: {
          MyColl: {},
        },
        functions: {
          MyFunc: {
            body: "_ => 1",
          },
        },
        roles: {
          PrivilegedRole: {
            privileges: [
              {
                resource: "MyColl",
                actions: {
                  create: true,
                  delete: true,
                  read: true,
                  write: true,
                  history_read: true,
                  history_write: true,
                },
              },
              {
                resource: "MyFunc",
                actions: {
                  call: true,
                },
              },
            ],
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL v10 schema update in progress...",
        "Collection: MyColl created",
        "Function: MyFunc created",
        "Role: PrivilegedRole created",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL v10 schema update in progress...",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run update
      const newConfig = {
        collections: {
          MyColl: {},
        },
        functions: {
          MyFunc2: {
            body: "_ => 1",
          },
        },
        roles: {
          PrivilegedRole: {
            privileges: [
              {
                resource: "MyColl",
                actions: {
                  create: true,
                  delete: true,
                  read: true,
                  write: true,
                  history_read: true,
                  history_write: true,
                },
              },
              {
                resource: "MyFunc2",
                actions: {
                  call: true,
                },
              },
            ],
          },
        },
      };
      await runDeploy(newConfig);
      logs = [
        "FQL v10 schema update in progress...",
        "Function: MyFunc2 created",
        "Role: PrivilegedRole updated",
        "Function: MyFunc deleted",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, newConfig.roles);

      // Run remove
      await runRemove(newConfig);
      logs = [
        "FQL v10 schema remove in progress...",
        "Collection: MyColl deleted",
        "Function: MyFunc2 deleted",
        "Role: PrivilegedRole deleted",
        "FQL v10 schema remove complete",
      ];
      await verifyLogs(log, logs);
      await verifyNoRoles();
    });

    it("manages a role with memberships", async () => {
      const config = {
        collections: {
          Users: {},
          Sites: {},
        },
        roles: {
          MembershipRole: {
            membership: [
              {
                resource: "Users",
                predicate: "user => user.isAdmin",
              },
            ],
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL v10 schema update in progress...",
        "Collection: Users created",
        "Collection: Sites created",
        "Role: MembershipRole created",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL v10 schema update in progress...",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, config.roles);

      // Run update
      const newConfig = {
        collections: {
          Users: {},
          Sites: {},
        },
        roles: {
          MembershipRole: {
            membership: [
              {
                resource: "Users",
                predicate: "user => user.isAdmin",
              },
              {
                resource: "Sites",
              },
            ],
          },
        },
      };

      await runDeploy(newConfig);
      logs = [
        "FQL v10 schema update in progress...",
        "Role: MembershipRole updated",
        "FQL v10 schema update complete",
      ];
      await verifyLogs(log, logs);
      await verifyRoles(client, newConfig.roles);

      // Run remove
      await runRemove(newConfig);
      logs = [
        "FQL v10 schema remove in progress...",
        "Collection: Sites deleted",
        "Collection: Users deleted",
        "Role: MembershipRole deleted",
        "FQL v10 schema remove complete",
      ];
      await verifyLogs(log, logs);
      await verifyNoRoles();
    });
  });
});
