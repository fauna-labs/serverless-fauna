const { query: q } = require('faunadb')
const { Ref } = require('faunadb').values

const BaseFQL = q.Lambda('ref', [ q.Var('ref'), "this/is/not/a/comment" ])
const BaseFQLString = `
/*
 * Leading comment block
 */
Lambda(
  "ref", // Comment
  // Comment
  [
    Var("ref" /* Inline comment */),
    "this/is/not/a/comment"
  ]
)
`

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
      source: [{ collection: new Ref('users', new Ref('collections')) }],
      terms: [{ field: ['data', 'test'] }],
    },
  ],
  functions: [
    { name: 'register', data: defaultData, body: q.Query(BaseFQL), role: null },
    {
      name: 'test_circular_dependency',
      data: defaultData,
      body: q.Query(BaseFQL),
      role: new Ref('test_circular_dependency', new Ref('roles')),
    },
  ],
  roles: [
    {
      name: 'test_circular_dependency',
      data: defaultData,
      membership: [
        {
          resource: new Ref('users', new Ref('collections')),
          predicate: q.Query(BaseFQL),
        },
      ],
      privileges: [
        {
          resource: new Ref('test_circular_dependency', new Ref('functions')),
          actions: { call: true },
        },
      ],
    },
    {
      name: 'customer',
      data: defaultData,
      membership: [
        {
          resource: new Ref('users', new Ref('collections')),
          predicate: q.Query(BaseFQL),
        },
      ],
      privileges: [
        {
          resource: new Ref('user_by_email', new Ref('indexes')),
          actions: { read: true },
        },
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
