const FQLXDeployCommand = require("../../commands/FQLXDeployCommand");
const {Client, fql} = require("fauna");
const clientConfig = require("../config")
const Logger = require("../../Logger");


describe('FQLXDeployCommand', () => {
  let faunaClient
  const log = jest.fn()
  const logger = new Logger({ log })

  const cleanup = async () => {
    let res = await faunaClient.query(fql`Function.all().map(f => f.delete())`)
    let a = res.data?.after
    while (a != null) {
      const page = await faunaClient.query(fql`Set.paginate(${a})`)
      a = page.data?.after
    }
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
        "FQL X schema remove transactions in progress..."
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
        "FQL X schema remove transactions in progress..."
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
        "FQL X schema remove transactions in progress..."
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
        "FQL X schema remove transactions in progress...",
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
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdate updated",
        "FQL X schema remove transactions in progress...",
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
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: ToUpdateNoData updated",
        "FQL X schema remove transactions in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("removes nested data", async () => {
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

      delete config.functions.NestedUpdate.data.nest.eggs

      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: NestedUpdate created",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "function: NestedUpdate updated",
        "FQL X schema remove transactions in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      delete config.functions.NestedUpdate.data.nest.eggs
      await verify({funcs: objToArray(config.functions)})
    })

    it("ignores resources managed by FQL 4 plugin", async () => {
      // Create a few functions
      await faunaClient.query(
        fql`[
          Function.create({ name: "V4Like1", body: "_ => 'v4like1'", data: { created_by_serverless_plugin: true }}),
          Function.create({ name: "V4Like2", body: "_ => 'v4like2'", data: { created_by_serverless_plugin: "fauna:v4" }}),
        ]`
      )

      const config = {
        functions: {
          Managed: {
            body: "_ => 'managed'",
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: Managed created",
        "FQL X schema remove transactions in progress...",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      const existing = await faunaClient.query(fql`Function.all().map( .name )`)
      const expected = ["Managed", "V4Like1", "V4Like2"]
      expect(existing.data.data.length).toEqual(expected.length)
      for (const e of expected) {
        expect(existing.data.data).toContain(e)
      }
    })

    it("upgrades a resource be managed by the FQL X command", async () => {
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
          Unmanaged: {
            body: "_ => 'unmanaged'"
          },
          V4Like1: {
            body: "_ => 'v4like1'",
          },
          V4Like2: {
            body: "_ => 'v4like2'",
          }
        }
      }

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      delete config.functions.V4Like2
      new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const logs = [
        "FQL X schema create/update transaction in progress...",
        "function: Unmanaged updated",
        "function: V4Like1 updated",
        "function: V4Like2 updated",
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
        "function: V4Like2 deleted",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      await verify({funcs: objToArray(config.functions)})
    })

    it("handles a reasonably sized config", async () => {
      const config = {
        functions: {}
      }

      const num = 150
      const logs = ["FQL X schema create/update transaction in progress..."]
      for (let i = 0; i < num; i++) {
        const f = `Func${i}`
        config.functions[f] = { body: `_ => ${i}`}
        logs.push(`function: ${f} created`)
      }
      logs.push("FQL X schema remove transactions in progress...")


      const cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      const existing = []
      let res = await faunaClient.query(fql`Function.all().map( .name )`)
      existing.push(...(res.data.data ?? []))
      let after = res.data.after
      while (after != null) {
        res = await faunaClient.query(fql`Set.paginate(${after})`)
        existing.push(...(res.data.data ?? []))
        after = res.data.after
      }

      expect(existing.length).toEqual(num)
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
        "FQL X schema remove transactions in progress...",
        "FQL X schema create/update transaction in progress...",
        "FQL X schema remove transactions in progress...",
        "function: Managed2 deleted",
      ]
      expect(log.mock.calls.map(c => c[0])).toEqual(logs)

      const existing = await faunaClient.query(fql`Function.all().map( .name )`)
      const expected = ["Managed1", "Unmanaged", "V4Like1", "V4Like2"]
      expect(existing.data.data.length).toEqual(expected.length)
      for (const e of expected) {
        expect(existing.data.data).toContain(e)
      }
    })

    it("removes all `fauna:v10` functions with pagination", async () => {
      const config = {
        functions: {}
      }

      const num = 99
      const deletes = ["FQL X schema create/update transaction in progress...", "FQL X schema remove transactions in progress..."]
      const logs = ["FQL X schema create/update transaction in progress..."]
      for (let i = 1; i <= num; i++) {
        const f = `Func${i < 10 ? "0" + i : i}`
        config.functions[f] = { body: `_ => ${i}`}
        logs.push(`function: ${f} created`)
        if (i !== 1) {
          deletes.push(`function: ${f} deleted`)
        }
      }
      logs.push("FQL X schema remove transactions in progress...")
      logs.push(...deletes)

      let cmd = new FQLXDeployCommand({
        config,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      const nextConfig = {
        functions: {
          Func01: {
            body: "_ => 1"
          }
        }
      }

      cmd = new FQLXDeployCommand({
        config: nextConfig,
        faunaClient,
        logger,
      })

      await cmd.deploy()

      expect(log.mock.calls.map(c => c[0])).toEqual(logs)
      await verify({funcs: objToArray(nextConfig.functions)})
    })
  })
})