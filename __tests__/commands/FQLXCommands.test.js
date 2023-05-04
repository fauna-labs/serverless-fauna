const FQLXCommands = require("../../commands/FQLXCommands");
const { Client, fql } = require("fauna");
const clientConfig = require("../config");
const Logger = require("../../Logger");

describe("FQLXCommands", () => {
  let faunaClient;
  const log = jest.fn();
  const logger = new Logger({ log });

  const deploy = async (cfg) => {
    const cmd = new FQLXCommands({ config: cfg, faunaClient, logger });
    await cmd.deploy();
  };

  const remove = async (cfg) => {
    const cmd = new FQLXCommands({ config: cfg, faunaClient, logger });
    await cmd.remove();
  };

  const paginate = async (token) => {
    while (token != null) {
      const page = await faunaClient.query(fql`Set.paginate(${token})`);
      token = page.data?.after;
    }
  };

  const cleanup = async () => {
    let res = await faunaClient.query(
      fql`Collection.all().map(f => f.delete())`
    );
    await paginate(res.data?.after);

    res = await faunaClient.query(fql`Function.all().map(f => f.delete())`);
    await paginate(res.data?.after);

    res = await faunaClient.query(fql`Role.all().map(f => f.delete())`);
    await paginate(res.data?.after);
  };

  const objToArray = (obj) => {
    return Object.entries(obj).map(([k, v]) => {
      return {
        name: k,
        ...v,
      };
    });
  };

  const mergeMetadata = (f) => {
    const md = {
      created_by_serverless_plugin: "fauna:v10",
      deletion_policy: "destroy",
    };
    const merged = { ...md, ...f.data };
    return {
      ...f,
      data: merged,
    };
  };

  const verifyLogs = (logs) => {
    expect(log.mock.calls.map((c) => c[0])).toEqual(logs);
  };

  const verify = async ({ functions = {}, collections = {}, roles = {} }) => {
    functions = objToArray(functions);
    collections = objToArray(collections);
    roles = objToArray(roles);

    if (functions.length > 0) {
      functions = functions
        .map(mergeMetadata)
        .sort((a, b) => (a.name > b.name ? 1 : -1));
      const actualFunctions = await faunaClient.query(
        fql`Function.all().order( .name )`
      );
      if (functions.length !== actualFunctions.data.data.length) {
        expect(actualFunctions.data.data).toEqual(functions);
      }

      for (let i = 0; i < functions.length; i++) {
        const e = functions[i];
        const a = actualFunctions.data.data[i];

        expect(a.data).toEqual(e.data);
        expect(a.name).toEqual(e.name);
        expect(a.body).toEqual(e.body);
        expect(a.role).toEqual(e.role);
      }
    }

    if (collections.length > 0) {
      collections = collections
        .map(mergeMetadata)
        .sort((a, b) => (a.name > b.name ? 1 : -1));

      const actualCollections = await faunaClient.query(
        fql`Collection.all().order( .name )`
      );
      if (collections.length !== actualCollections.data.data.length) {
        expect(actualCollections.data.data).toEqual(functions);
      }

      for (let i = 0; i < collections.length; i++) {
        const e = collections[i];
        const a = actualCollections.data.data[i];

        expect(a.data).toEqual(e.data);
        expect(a.name).toEqual(e.name);

        let actualIndexKeys = Object.keys(a.indexes);
        if (actualIndexKeys.length !== Object.keys(e.indexes).length) {
          expect(a.indexes).toEqual(e.indexes);
        }

        for (const k of actualIndexKeys) {
          let actual = a.indexes[k];
          let expected = e.indexes[k];

          // we don't manage these fields, so delete them for the diff
          delete actual["queryable"];
          delete actual["status"];
          expect(actual).toEqual(expected);
        }
      }
    }

    if (roles.length > 0) {
      roles = roles
        .map(mergeMetadata)
        .sort((a, b) => (a.name > b.name ? 1 : -1));

      const actualRoles = await faunaClient.query(
        fql`Role.all().order( .name )`
      );
      if (roles.length !== actualRoles.data.data.length) {
        expect(actualRoles.data.data).toEqual(functions);
      }

      for (let i = 0; i < roles.length; i++) {
        const e = roles[i];
        const a = actualRoles.data.data[i];

        expect(a.data).toEqual(e.data);
        expect(a.name).toEqual(e.name);
        expect(a.privileges).toEqual(e.privileges);
        expect(a.membership).toEqual(e.membership);
      }
    }
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
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  describe("everything", () => {
    const config = {
      collections: {
        MyFirstCollection: {
          indexes: {
            byAnything: {
              terms: [
                {
                  field: "anything",
                },
              ],
              values: [
                {
                  field: "anything",
                },
              ],
            },
          },
        },
      },
      roles: {
        MyFirstRole: {
          privileges: [
            {
              resource: "MyFirstCollection",
              actions: {
                create: true,
              },
            },
            {
              resource: "MyFirstFunction",
              actions: {
                call: true,
              },
            },
          ],
        },
      },
      functions: {
        MyFirstFunction: {
          body: "_ => [MyFirstCollection.definition, MyFirstFunction.definition]",
        },
      },
    };

    it("creates and removes all resources", async () => {
      await deploy(config);

      let logs = [
        "FQL X schema create/update transaction in progress...",
        "Collection: MyFirstCollection created",
        "Function: MyFirstFunction created",
        "Role: MyFirstRole created",
        "FQL X schema remove transactions in progress...",
      ];

      verifyLogs(logs);
      await verify(config);
      log.mockClear();
      await remove(config);

      logs = [
        "FQL X schema remove transactions in progress...",
        "Collection: MyFirstCollection deleted",
        "Function: MyFirstFunction deleted",
        "Role: MyFirstRole deleted",
      ];
      verifyLogs(logs);

      expect(
        (await faunaClient.query(fql`Function.all().toArray()`)).data
      ).toEqual([]);
      expect((await faunaClient.query(fql`Role.all().toArray()`)).data).toEqual(
        []
      );
      expect(
        (await faunaClient.query(fql`Collection.all().toArray()`)).data
      ).toEqual([]);
    });
  });

  describe("collections", () => {
    const config = {
      collections: {
        BasicCollection: {
          indexes: {
            byAnything: {
              terms: [
                {
                  field: "anything",
                },
              ],
              values: [
                {
                  field: "anything",
                },
              ],
            },
          },
          constraints: [
            {
              unique: ["anything"],
            },
          ],
        },
      },
    };

    it("creates, noops, and updates a collection", async () => {
      await deploy(config);
      logs = [
        "FQL X schema create/update transaction in progress...",
        "Collection: BasicCollection created",
        "FQL X schema remove transactions in progress...",
      ];

      verifyLogs(logs);
      await verify(config);
      log.mockClear();

      await deploy(config);
      logs = [
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
      ];

      // TODO: This results in an update still. Prob need a more explicit diff.
      // verifyLogs(logs)
      // await verify(config)
    });
  });

  describe("roles", () => {});

  describe("functions", () => {
    it("creates a single function without data", async () => {
      const config = {
        functions: {
          NoData: {
            body: "_ => 1",
          },
        },
      };

      await deploy(config);
      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: NoData created",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      await verify(config);
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

      await deploy(config);
      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: NoRole created",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);
      await verify(config);
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

      await deploy(config);
      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: WithRole created",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      await verify(config);
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

      await deploy(config);
      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: WithServerRole created",
        "Function: WithAdminRole created",
        "Function: DoubleData created",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      await verify(config);
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

      await deploy(config);
      config.functions.ToUpdate.body = "_ => 'new'";
      config.functions.ToUpdate["role"] = "admin";
      config.functions.ToUpdate.data["new"] = "school";
      delete config.functions.ToUpdate.data.old;
      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: ToUpdate created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "Function: ToUpdate updated",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      await verify(config);
    });

    it("updates a function without data", async () => {
      const config = {
        functions: {
          ToUpdateNoData: {
            body: "_ => 1",
          },
        },
      };

      await deploy(config);
      config.functions.ToUpdateNoData.body = "_ => 'new'";
      config.functions.ToUpdateNoData["role"] = "admin";
      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: ToUpdateNoData created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "Function: ToUpdateNoData updated",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      await verify(config);
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

      await deploy(config);
      delete config.functions.NestedUpdate.data.nest.eggs;
      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: NestedUpdate created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "Function: NestedUpdate updated",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      delete config.functions.NestedUpdate.data.nest.eggs;
      await verify(config);
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

      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: Managed created",
        "FQL X schema remove transactions in progress...",
      ];
      verifyLogs(logs);

      const existing = await faunaClient.query(
        fql`Function.all().map( .name )`
      );
      const expected = ["Managed", "V4Like1", "V4Like2"];
      expect(existing.data.data.length).toEqual(expected.length);
      for (const e of expected) {
        expect(existing.data.data).toContain(e);
      }
    });

    it("upgrades a resource be managed by the FQL X command", async () => {
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

      await deploy(config);
      delete config.functions.V4Like2;
      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: Unmanaged updated",
        "Function: V4Like1 updated",
        "Function: V4Like2 updated",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
        "Function: V4Like2 deleted",
      ];
      verifyLogs(logs);

      await verify(config);
    });

    it("handles a reasonably sized config", async () => {
      const config = {
        functions: {},
      };

      const num = 50;
      const logs = ["FQL X schema create/update transaction in progress..."];
      for (let i = 0; i < num; i++) {
        const f = `Func${i}`;
        config.functions[f] = { body: `_ => ${i}` };
        logs.push(`Function: ${f} created`);
      }
      logs.push("FQL X schema remove transactions in progress...");

      await deploy(config);
      verifyLogs(logs);

      const existing = [];
      let res = await faunaClient.query(fql`Function.all().map( .name )`);
      existing.push(...(res.data.data ?? []));
      let after = res.data.after;
      while (after != null) {
        res = await faunaClient.query(fql`Set.paginate(${after})`);
        existing.push(...(res.data.data ?? []));
        after = res.data.after;
      }

      expect(existing.length).toEqual(num);
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

      await deploy(config);
      delete config.functions.Managed2;
      await deploy(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: Managed1 created",
        "Function: Managed2 created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
        "Function: Managed2 deleted",
      ];
      verifyLogs(logs);

      const existing = await faunaClient.query(
        fql`Function.all().map( .name )`
      );
      const expected = ["Managed1", "Unmanaged", "V4Like1", "V4Like2"];
      expect(existing.data.data.length).toEqual(expected.length);
      for (const e of expected) {
        expect(existing.data.data).toContain(e);
      }
    });

    it("removes all `fauna:v10` functions with pagination", async () => {
      const config = {
        functions: {},
      };

      const num = 50;
      const deletes = [
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
      ];
      const logs = ["FQL X schema create/update transaction in progress..."];
      for (let i = 1; i <= num; i++) {
        const f = `Func${i < 10 ? "0" + i : i}`;
        config.functions[f] = { body: `_ => ${i}` };
        logs.push(`Function: ${f} created`);
        if (i !== 1) {
          deletes.push(`Function: ${f} deleted`);
        }
      }
      logs.push("FQL X schema remove transactions in progress...");
      logs.push(...deletes);

      await deploy(config);

      const nextConfig = {
        functions: {
          Func01: {
            body: "_ => 1",
          },
        },
      };

      await deploy(nextConfig);
      verifyLogs(logs);
      await verify(nextConfig);
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

      await deploy(config);
      await remove(config);

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "Function: Managed1 created",
        "Function: Managed2 created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema remove transactions in progress...",
        "Function: Managed1 deleted",
        "Function: Managed2 deleted",
      ];
      verifyLogs(logs);

      const existing = await faunaClient.query(
        fql`Function.all().map( .name )`
      );
      const expected = ["Unmanaged", "V4Like1", "V4Like2"];
      expect(existing.data.data.length).toEqual(expected.length);
      for (const e of expected) {
        expect(existing.data.data).toContain(e);
      }
    });
  });
});
