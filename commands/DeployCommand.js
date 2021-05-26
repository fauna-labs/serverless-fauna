const DeployQueries = require('../fauna/DeployQueries')
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
    const {
      collections = {},
      functions = {},
      indexes = {},
      roles = {},
    } = this.config
    try {
      this.logger.info('Schema updating in process...')
      const queries = DeployQueries({
        roles: Object.values(roles).map((role) => this.roleAdapter(role)),
        collections: Object.values(collections),
        functions: Object.values(functions).map((fn) =>
          this.functionAdapter(fn)
        ),
        indexes: Object.values(indexes).map((index) =>
          this.indexAdapter(index)
        ),
      })

      let isSchemaUpdated
      for (const { query, name } of queries) {
        await this.faunaClient
          .query(query)
          .then((resp) => {
            if (resp) {
              isSchemaUpdated = true
              this.logger.success(resp)
            }
          })
          .catch((errResp) => this.handleQueryError({ errResp, name }))
      }

      if (!isSchemaUpdated) {
        this.logger.success('Schema up to date')
      }
    } catch (error) {
      this.logger.error(error)
    }
  }

  handleQueryError({ errResp, name }) {
    if (!errResp.requestResult) throw errResp
    const error = errResp.requestResult.responseContent.errors[0]
    console.info(error)
    if (error.failures) {
      const failures = error.failures
        .map((f) => [`\`${f.field}\``, f.description].join(': '))
        .join('; ')
      throw new Error([name, failures].join(' => '))
    }

    throw new Error([name, error.description].join(' => '))
  }

  functionAdapter(fn) {
    try {
      return {
        ...fn,
        role: fn.role
          ? ['admin', 'server'].includes(fn.role)
            ? fn.role
            : q.Role(fn.role)
          : null,
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
    const adaptedSource = {
      collection: q.Collection(
        typeof source === 'string' ? source : source.collection
      ),
    }

    if (source.fields) {
      adaptedSource.fields = {}

      Object.keys(source.fields).forEach((bindingKey) => {
        adaptedSource.fields[bindingKey] = baseEvalFqlQuery(
          source.fields[bindingKey]
        )
      })
    }

    return adaptedSource
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

  roleAdapter({ name, privileges, membership }) {
    try {
      const adaptedRole = { name }

      if (membership) {
        adaptedRole.membership = (
          Array.isArray(membership) ? membership : [membership]
        ).map((m) => {
          return {
            resource: q.Collection(typeof m === 'string' ? m : m.resource),
            ...(m.predicate && { predicate: baseEvalFqlQuery(m.predicate) }),
          }
        })
      }

      const PrivilegesMap = {
        collection: q.Collection,
        index: q.Index,
        function: q.Function,
        collections: q.Collections,
        databases: q.Databases,
        indexes: q.Indexes,
        roles: q.Roles,
        functions: q.Functions,
        keys: q.Keys,
      }
      adaptedRole.privileges = privileges.map((privilege) => {
        const resourceType = Object.keys(privilege).find((key) =>
          Object.keys(PrivilegesMap).includes(key)
        )

        const actions = Object.fromEntries(
          Object.entries(privilege.actions).map(([key, value]) => [
            key,
            typeof value === 'boolean' ? value : baseEvalFqlQuery(value),
          ])
        )

        return {
          actions,
          resource: PrivilegesMap[resourceType](privilege[resourceType]),
        }
      })

      return adaptedRole
    } catch (error) {
      throw new Error(`role.${role.name}: ${error.message}`)
    }
  }
}

module.exports = DeployCommand
