const deploy = require('../fauna/deploy')

class DeployCommand {
  command = {
    deploy: {
      usage:
        'deploy fauna schema. the same logic executed for `sls deploy` command',
      lifecycleEvents: ['deploy'],
    },
  }

  hooks = {
    'deploy:deploy': this.deploy.bind(this),
    'fauna:deploy:deploy': this.deploy.bind(this),
  }

  constructor({ serverless, faunaClient, logger }) {
    this.serverless = serverless
    this.faunaClient = faunaClient
    this.logger = logger
  }

  deploy() {
    const { collections, indexes } = this.serverless.service.custom.fauna
    return deploy({
      collections,
      indexes,
    })
      .then((result) =>
        result.length
          ? result.forEach(this.logger.success)
          : this.logger.success('Schema up to date')
      )
      .catch((err) => this.logger.error(err))
  }
}

module.exports = DeployCommand
