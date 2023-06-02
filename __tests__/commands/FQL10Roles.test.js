const FQLXCommands = require("../../commands/FQLXCommands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");
const { objToArray, mergeDefaultMetadata } = require("../utils/objects");
const { cleanup } = require("../utils/cleanup");

describe("FQL10_Roles", () => {
  let faunaClient;
  const log = jest.fn();
  const logger = new Logger({ log });

  const verifyNoRoles = async () => {
    const actual = await faunaClient.query(fql`Role.all().count()`);
    expect(actual.data).toEqual(0);
  };

  const verifyLogs = (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
    log.mockClear();
  };

  const verify = async (roles) => {
    roles = objToArray(roles);
    roles = roles
      .map(mergeDefaultMetadata)
      .sort((a, b) => (a.name > b.name ? 1 : -1));

    const actual = await faunaClient.query(
      fql`Role.all().order( .name ).toArray()`
    );
    if (roles.length !== actual.data.length) {
      expect(actual.data).toEqual(roles);
    }

    for (let i = 0; i < roles.length; i++) {
      const e = roles[i];
      const a = actual.data[i];

      expect(a.data).toEqual(e.data);
      expect(a.membership).toEqual(e.indexes);
      expect(a.privileges).toEqual(e.privileges);
    }
  };

  const runDeploy = async (config, dryrun = false) => {
    const cmd = new FQLXCommands({
      config,
      faunaClient,
      logger,
      options: { dryrun },
    });

    await cmd.deploy();
  };

  const runRemove = async (config, dryrun = false) => {
    const cmd = new FQLXCommands({
      config,
      faunaClient,
      logger,
      options: { dryrun },
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

  describe("role create / update / remove", () => {
    it("manages a role with data", async () => {
      const config = {
        roles: {
          MyRole: {
            data: { dog: "Scout" },
          },
        },
      };

      // Run create with dryrun
      await runDeploy(config, true);
      let logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Role MyRole: created",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verifyNoRoles();

      // Run create
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Role MyRole: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run noop with dryrun
      await runDeploy(config, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run update with dry run
      const newConfig = {
        roles: {
          MyRole: {
            data: { cat: "Sparky" },
          },
        },
      };
      await runDeploy(newConfig, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Role MyRole: updated",
        '-   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","dog":"Scout"}',
        '+   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","cat":"Sparky"}',
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run update
      await runDeploy(newConfig);
      logs = [
        "FQL 10 schema update in progress...",
        "Role MyRole: updated",
        '-   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","dog":"Scout"}',
        '+   data: {"created_by_serverless_plugin":"fauna:v10","deletion_policy":"destroy","cat":"Sparky"}',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.roles);

      // Run remove with dryrun
      await runRemove(config, true);
      logs = [
        "(DryRun) FQL 10 schema removal in progress...",
        "(DryRun) Role MyRole: deleted",
        "(DryRun) FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.roles);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema removal in progress...",
        "Role MyRole: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
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
            ],
          },
        },
      };

      // Run create with dryrun
      await runDeploy(config, true);
      let logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Collection MyColl: created",
        "(DryRun) Function MyFunc: created",
        "(DryRun) Role PrivilegedRole: created",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verifyNoRoles();

      // Run create
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection MyColl: created",
        "Function MyFunc: created",
        "Role PrivilegedRole: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run noop with dryrun
      await runDeploy(config, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run update dryrun
      const newConfig = {
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

      await runDeploy(newConfig, true);
      logs = [
        "(DryRun) FQL 10 schema update in progress...",
        "(DryRun) Role PrivilegedRole: updated",
        '-   privileges: [{"resource":"MyColl","actions":{"create":true,"delete":true,"read":true,"write":true,"history_read":true,"history_write":true}}]',
        '+   privileges: [{"resource":"MyColl","actions":{"create":true,"delete":true,"read":true,"write":true,"history_read":true,"history_write":true}},{"resource":"MyFunc","actions":{"call":true}}]',
        "(DryRun) FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.roles);

      // Run update
      await runDeploy(newConfig);
      logs = [
        "FQL 10 schema update in progress...",
        "Role PrivilegedRole: updated",
        '-   privileges: [{"resource":"MyColl","actions":{"create":true,"delete":true,"read":true,"write":true,"history_read":true,"history_write":true}}]',
        '+   privileges: [{"resource":"MyColl","actions":{"create":true,"delete":true,"read":true,"write":true,"history_read":true,"history_write":true}},{"resource":"MyFunc","actions":{"call":true}}]',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.roles);

      // Run remove dryrun
      await runRemove(newConfig, true);
      logs = [
        "(DryRun) FQL 10 schema removal in progress...",
        "(DryRun) Collection MyColl: deleted",
        "(DryRun) Function MyFunc: deleted",
        "(DryRun) Role PrivilegedRole: deleted",
        "(DryRun) FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verify(newConfig.roles);

      // Run remove
      await runRemove(newConfig);
      logs = [
        "FQL 10 schema removal in progress...",
        "Collection MyColl: deleted",
        "Function MyFunc: deleted",
        "Role PrivilegedRole: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verifyNoRoles();
    });

    it("manages a collection with an index with values", async () => {
      const config = {
        collections: {
          IndexWithValues: {
            indexes: {
              byName: {
                values: [{ field: "name" }],
              },
            },
          },
        },
      };

      // Run create
      await runDeploy(config);
      let logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithValues: created",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run noop
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run update
      config.collections.IndexWithValues.indexes.byName.values = [
        { field: "pet_name", order: "desc" },
      ];
      await runDeploy(config);
      logs = [
        "FQL 10 schema update in progress...",
        "Collection IndexWithValues: updated",
        '-   indexes: {"byName":{"values":[{"field":"name","order":"asc"}],"queryable":true}}',
        '+   indexes: {"byName":{"values":[{"field":"pet_name","order":"desc"}],"queryable":true}}',
        "FQL 10 schema update complete",
      ];
      verifyLogs(logs);
      await verify(config.collections);

      // Run remove
      await runRemove(config);
      logs = [
        "FQL 10 schema removal in progress...",
        "Collection IndexWithValues: deleted",
        "FQL 10 schema removal complete",
      ];
      verifyLogs(logs);
      await verifyNoRoles();
    });
  });

  it("manages a collection with constraints", async () => {
    const config = {
      collections: {
        CollectionWithConstraints: {
          constraints: [{ unique: ["name"] }],
        },
      },
    };

    // Run Create
    await runDeploy(config);
    let logs = [
      "FQL 10 schema update in progress...",
      "Collection CollectionWithConstraints: created",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Run Noop
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Test Update
    config.collections.CollectionWithConstraints.constraints = [
      { unique: ["pet_name"] },
    ];
    await runDeploy(config);
    logs = [
      "FQL 10 schema update in progress...",
      "Collection CollectionWithConstraints: updated",
      '-   constraints: [{"unique":["name"]}]',
      '+   constraints: [{"unique":["pet_name"]}]',
      "FQL 10 schema update complete",
    ];
    verifyLogs(logs);
    await verify(config.collections);

    // Run remove
    await runRemove(config);
    logs = [
      "FQL 10 schema removal in progress...",
      "Collection CollectionWithConstraints: deleted",
      "FQL 10 schema removal complete",
    ];
    verifyLogs(logs);
    await verifyNoRoles();
  });
});
