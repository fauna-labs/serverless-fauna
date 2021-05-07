const deploy = require('../fauna/deploy')
const { query: q, Expr } = require('faunadb')
const baseEvalFql = require('../fauna/baseEvalFql')

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

  constructor({ config, faunaClient, logger }) {
    this.config = config
    this.faunaClient = faunaClient
    this.logger = logger
  }

  deploy() {
    const { collections, indexes } = this.config
    return deploy({
      collections: Object.values(collections),
      indexes: Object.values(indexes).map((index) => ({
        ...index,
        source: (Array.isArray(index.source)
          ? index.source
          : [index.source]
        ).map(this.indexSourceAdapter),
        ...(index.terms && { terms: this.indexTermsAdapter(index.terms) }),
        ...(index.values && { values: this.indexValuesAdapter(index.values) }),
      })),
    })
      .then((result) =>
        result.length
          ? result.forEach(this.logger.success)
          : this.logger.success('Schema up to date')
      )
      .catch((err) => this.logger.error(err))
  }

  indexSourceAdapter(source) {
    const adapterSource = {
      collection: q.Collection(
        typeof source === 'string' ? source : source.collection
      ),
    }

    if (source.fields) {
      adapterSource.fields = {}

      Object.keys(source.fields).forEach((bindingKey) => {
        const fql = baseEvalFql(source.fields[bindingKey])
        if (fql.length != 1) throw new Error('Binding must have only 1 query')
        adapterSource.fields[bindingKey] = q.Query(q.Lambda('doc', fql[0]))
        console.info(Expr.toString(adapterSource.fields[bindingKey]))
      })
    }

    return adapterSource
  }

  indexValuesAdapter({ fields = [], bindings = [] }) {
    return [
      ...fields.map((field) =>
        typeof field === 'string'
          ? { field: field.split('.') }
          : {
              reverse: field.reverse,
              field: field.path.split('.'),
            }
      ),
      ...bindings.map((binding) => ({ binding })),
    ]
  }

  indexTermsAdapter({ fields = [], bindings = [] }) {
    return [
      ...fields.map((field) => ({ field: field.split('.') })),
      ...bindings.map((binding) => ({ binding })),
    ]
  }
}

module.exports = DeployCommand
