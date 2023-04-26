const queryBuilder = require('../fqlx/queries/queryBuilder')
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
    'deploy:deploy': this.deploy.bind(this),
    'fqlx:deploy:deploy': this.deploy.bind(this),
  }

  constructor({config, faunaClient, logger}) {
    this.config = config
    this.client = faunaClient
    this.logger = logger
    this.defaultMetadata = {
      created_by_serverless_plugin: true,
      fauna_api_version: "10",
      deletion_policy: config?.deletion_policy || 'destroy',
    }
  }

  mergeMetadata(data = {}) {
    return { ...this.defaultMetadata, ...data }
  }

  async deploy() {
    const {
      functions = {},
    } = this.config
    try {
      this.logger.info('Schema updating in process...')

      const q = queryBuilder({
        functions: Object.values(functions).map(
          f => {
            return {...f, data: this.mergeMetadata(f.data)}
          }
        ),
      })

      const res = await this.client.query(q)

      res.data.forEach(d => {
        const log = `${d.type}: ${d.name} was ${d.result}`
        if (["created", "updated"].includes(d.result)) {
          this.logger.info(log)
        } else {
          this.logger.success(log)
        }
      })

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
}

module.exports = FQLXDeployCommand
