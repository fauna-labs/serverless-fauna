const deploy = require('../fauna/deploy')
const { query: q } = require('faunadb')
const baseEvalFqlQuery = require('../fauna/baseEvalFqlQuery')

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

  async deploy() {
    const { collections, functions, indexes } = this.config
    try {
      const result = await deploy({
        collections: Object.values(collections),
        functions: Object.values(functions).map((fn) =>
          this.functionAdapter(fn)
        ),
        indexes: Object.values(indexes).map((index) =>
          this.indexAdapter(index)
        ),
      })

      return result.length
        ? result.forEach(this.logger.success)
        : this.logger.success('Schema up to date')
    } catch (error) {
      this.logger.error(error)
    }
  }

  functionAdapter(fn) {
    try {
      return {
        ...fn,
        body: baseEvalFqlQuery(fn.body),
      }
    } catch (error) {
      throw new Error(`function.${fn.name}: ${error.message}`)
    }
  }

  indexAdapter(index) {
    try {
      return {
        ...index,
        source: (Array.isArray(index.source)
          ? index.source
          : [index.source]
        ).map(this.indexSourceAdapter),
        ...(index.terms && { terms: this.indexTermsAdapter(index.terms) }),
        ...(index.values && { values: this.indexValuesAdapter(index.values) }),
      }
    } catch (error) {
      throw new Error(`index.${index.name}: ${error.message}`)
    }
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
        adapterSource.fields[bindingKey] = baseEvalFqlQuery(
          source.fields[bindingKey]
        )
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
