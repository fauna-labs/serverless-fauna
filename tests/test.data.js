const { query: q, Expr } = require('faunadb')

const BaseFQL = q.Lambda('ref', q.Var('ref'))
const BaseFQLString = Expr.toString(BaseFQL)

const defaultData = {
  created_by_serverless_plugin: true,
  deletion_policy: 'destroy',
}

const configForDeploy = {
  collections: [
    { name: 'users', data: { ...defaultData, deletion_policy: 'retain' } },
    { name: 'logs', data: defaultData },
  ],
  indexes: [
    {
      name: 'user_by_email',
      data: defaultData,
      source: [{ collection: q.Collection('users') }],
      terms: [{ field: ['data', 'test'] }],
    },
  ],
  functions: [
    { name: 'register', data: defaultData, body: q.Query(BaseFQL), role: null },
  ],
  roles: [
    {
      name: 'customer',
      data: defaultData,
      membership: [
        {
          resource: q.Collection('users'),
          predicate: q.Query(BaseFQL),
        },
      ],
      privileges: [
        { resource: q.Index('user_by_email'), actions: { read: true } },
      ],
    },
  ],
}

module.exports = {
  configForDeploy,
  BaseFQLString,
  BaseFQL,
  defaultData,
}
