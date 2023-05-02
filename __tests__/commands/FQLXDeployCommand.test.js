const FQLXDeployCommand = require("../../commands/FQLXDeployCommand");
const {Client, fql} = require("fauna");
const clientConfig = require("../config")
const Logger = require("../../Logger");


describe('DeployCommand', () => {
  let faunaClient
  const log = jest.fn()
  const logger = new Logger({ log })

  const cleanup = async () => {
    await faunaClient.query(fql`Function.all().forEach(f => f.delete())`)
  }

  const objToArray = (obj) => {

    return Object.entries(obj).map(([k, v]) => {
      return {
        name: k,
        ...v,
      }
    })
  }

  const mergeMetadata = (f) => {
    const md = {created_by_serverless_plugin: "fauna:v10", deletion_policy: "destroy" }
    const merged = { ...md, ...f.data}
    return {
      ...f,
      data: merged,
    }
  }

  const verify = async ({ funcs = []}) => {
    funcs = funcs.map(mergeMetadata).sort((a, b) => a.name > b.name ? 1 : -1)

    const actual = await faunaClient.query(fql`Function.all().order( .name )`)
    if (funcs.length !== actual.data.data.length) {
      expect(actual.data.data).toEqual(funcs)
    }

    for (let i = 0; i < funcs.length; i++) {
      const e = funcs[i]
      const a = actual.data.data[i]

      expect(a.data).toEqual(e.data)
      expect(a.name).toEqual(e.name)
      expect(a.body).toEqual(e.body)
      expect(a.role).toEqual(e.role)
    }
  }

  beforeAll(async () => {
    const p = clientConfig.port
    const ep = `${clientConfig.scheme}://${clientConfig.domain}${p ? ":" + p : ""}`
    faunaClient = new Client({
      secret: clientConfig.secret,
      endpoint: new URL(ep),
    })

    await cleanup()
  })

  beforeEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  describe("functions", () => {

    it("creates a single function without data", async () => {
      const config = {
        functions: {
          NoData: {
            body: "_ => 1",
          }
        }
      }

      const cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: NoData created",
        "FQL X schema remove transaction in progress..."
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("creates a single function without role", async () => {
      const config = {
        functions: {
          NoRole: {
            body: "_ => 1",
            data: {
              extra: "Extra",
            }
          }
        }
      }

      const cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: NoRole created",
        "FQL X schema remove transaction in progress..."
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("creates single function with a role", async () => {
      const config = {
        functions: {
          WithRole: {
            body: "_ => 1",
            role: "server",
            data: {
              extra: "Extra",
            }
          }
        }
      }

      const cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: WithRole created",
        "FQL X schema remove transaction in progress..."
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("creates many functions with different properties", async () => {
      const config = {
        functions: {
          WithServerRole: {
            body: "_ => 1",
            role: "server",
            data: {
              extra: "Extra",
            }
          },
          WithAdminRole: {
            body: "_ => 2",
            role: "admin",
            data: {
              quite: "minty",
            }
          },
          DoubleData: {
            body: "_ => 3",
            data: {
              much: "data",
              many: "property",
            }
          }
        }
      }

      const cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: WithServerRole created",
        "function: WithAdminRole created",
        "function: DoubleData created",
        "FQL X schema remove transaction in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("updates a function body and data", async () => {
      const config = {
        functions: {
          ToUpdate: {
            body: "_ => 1",
            data: {
              old: "school",
            }
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      config.functions.ToUpdate.body = "_ => 'new'"
      config.functions.ToUpdate["role"] = "admin"
      config.functions.ToUpdate.data["new"] = "school"
      delete config.functions.ToUpdate.data.old

      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdate created",
        "FQL X schema remove transaction in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdate updated",
        "FQL X schema remove transaction in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("updates a function without data", async () => {
      const config = {
        functions: {
          ToUpdateNoData: {
            body: "_ => 1",
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      config.functions.ToUpdateNoData.body = "_ => 'new'"
      config.functions.ToUpdateNoData["role"] = "admin"

      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdateNoData created",
        "FQL X schema remove transaction in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdateNoData updated",
        "FQL X schema remove transaction in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    // TODO: Update the implementation to handle this case.
    it("requires explicit null to remove nested data", async () => {
      const config = {
        functions: {
          NestedUpdate: {
            body: "_ => 1",
            data: {
              nest: {
                eggs: 1,
              },
            }
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      config.functions.NestedUpdate.data.nest.eggs = null

      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: NestedUpdate created",
        "FQL X schema remove transaction in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: NestedUpdate updated",
        "FQL X schema remove transaction in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      delete config.functions.NestedUpdate.data.nest.eggs
      await verify({funcs: objToArray(config.functions)})
    })


    it("removes only `fauna:v10` functions", async () => {
      // Create a few functions
      await faunaClient.query(
        fql`[
          Function.create({ name: "Unmanaged", body: "_ => 'unmanaged'" }),
          Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
          Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }})
        ]`
      )

      const config = {
        functions: {
          Managed1: {
            body: "_ => 1",
          },
          Managed2: {
            body: "_ => 1",
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      delete config.functions.Managed2
      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: Managed1 created",
        "function: Managed2 created",
        "FQL X schema remove transaction in progress...",
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transaction in progress...",
        "function: Managed2 deleted",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      //TODO: do the validation


      // const existing = await faunaClient.query(fql`Function.all().order( .name )`)
      //
      // for (const f of existing.data.data) {
      //
      // }
    })
  })
})