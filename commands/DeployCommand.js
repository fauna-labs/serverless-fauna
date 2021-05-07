const deploy = require('../fauna/deploy')
const { query: q } = require('faunadb')

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
      collections: Object.values(collections),
      indexes: Object.values(indexes).map((i) => this.indexAdapter(i)),
    })
      .then((result) =>
        result.length
          ? result.forEach(this.logger.success)
          : this.logger.success('Schema up to date')
      )
      .catch((err) => this.logger.error(err))
  }

  indexAdapter(index) {
    const source = (Array.isArray(index.source)
      ? index.source
      : [index.source]
    ).map(({ collection, fields }) => {
      if (fields) throw new Error("index doesn't `source.fields` yet")
      return { collection: q.Collection(collection) }
    })

    const mapTermAndValues = ({ field = [], binding = [] }) => [
      ...field.map((field) => ({ field: field.split('.') })),
      ...binding.map((binding) => ({ binding })),
    ]

    return {
      ...index,
      source,
      ...(index.terms && { terms: mapTermAndValues(index.terms) }),
      ...(index.values && { values: mapTermAndValues(index.values) }),
    }
  }
}

module.exports = DeployCommand
