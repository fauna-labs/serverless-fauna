const deployQuery = require('../fqlx/queries/deploy')
const removeQuery = require('../fqlx/queries/remove')
const {ServiceError} = require("fauna");

class FQLXDeployCommand {
  command = {
    'deploy': {
      usage:
        'Deploy Fauna FQL X schema. (beta)',
      lifecycleEvents: ['deploy'],
    },
  }

  hooks = {
    'fqlx:deploy:deploy': this.deploy.bind(this),
  }

  constructor({config, faunaClient, logger}) {
    this.config = config
    this.client = faunaClient
    this.logger = logger
    this.defaultMetadata = {
      created_by_serverless_plugin: "fauna:v10",
      deletion_policy: config?.deletion_policy || 'destroy',
    }
  }

  mergeMetadata(data = {}) {
    return { ...this.defaultMetadata, ...data }
  }

  async tryLog(fn) {
    try {
      await fn()
    } catch (e) {
      if (e instanceof ServiceError) {
        this.logger.error(
          `${e.code}: ${e.message}\n---\n${e.queryInfo?.summary}`
        )
      } else {
        this.logger.error(e)
      }
    }
  }

  async deploy() {
    const {
      functions = {},
    } = this.config

    await this.tryLog(async () => {
      this.logger.info('FQL X schema create/update transaction in progress...')

      const q = deployQuery(this.adapt({functions}))
      const res = await this.client.query(q)

      res.data.forEach(d => {
        if (d.result !== "noop") {
          const log = `${d.type}: ${d.resources} ${d.result}`
          this.logger.success(log)
        }
      })

      await this.remove(true)
    })
  }

  async remove(withDeploy = false) {
    let {
      functions = {},
    } = this.config

    if (!withDeploy) {
      functions = {}
    }

    const log = (d) => {
      if (d.resources.data?.length !== 0) {
        const log = `${d.type}: ${d.resources.data?.map(d => d.ref?.name ?? "unknown")} ${d.result}`
        this.logger.error(log)
      }
    }

    const paginate = async (data) => {
      let a = data.after
      while (a != null) {
        const res = await this.client.query(`Set.paginate(${data.after})`)
        log(res.data)
        a = res.data.after
      }
    }

    await this.tryLog(async () => {
      this.logger.info('FQL X schema remove transaction in progress...')

      const q = removeQuery(this.adapt({functions}))
      const res = await this.client.query(q)

      for (const d of res.data) {
        log(d)
        if (d.data?.after != null) {
          await paginate(d.data)
        }
      }
    })
  }

  adapt({ functions = {} }) {
    return {
      functions: Object.entries(functions).map(
        ([k, v]) => {
          return { name: k, ...v, data: this.mergeMetadata(v.data)}
        }
      )
    }
  }
}

module.exports = FQLXDeployCommand
