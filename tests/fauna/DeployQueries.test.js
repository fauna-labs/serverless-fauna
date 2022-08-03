const { query: q, values, Expr } = require('faunadb')
const DeployQueries = require('../../fauna/DeployQueries')
const getClient = require('../../fauna/client')
const config = require('../config')
const { configForDeploy, defaultData } = require('../test.data')

async function faunaDeploy({ testClient, config, debugResp }) {
  let isSchemaUpdated
  for (const { query, name } of DeployQueries(config)) {
    await testClient.query(query).then((resp) => {
      if (debugResp) {
        console.info('----------' + name + '----------')
        console.info(Expr.toString(query))
        console.info(resp)
        console.info('------------------------------')
      }
      if (resp) isSchemaUpdated = true
    })
  }

  return { isSchemaUpdated }
}

describe('Fauna deploy', () => {
  const rootClient = getClient(config)
  let testClient
  let keyRef
  let dbRef
  const BaseFQLValue = new values.Query({
    lambda: 'ref',
    expr: [ { var: 'ref' }, "this/is/not/a/comment" ],
    api_version: '4',
  })

  beforeAll(async () => {
    const name = randomString('db_')
    const response = await rootClient.query(
      q.Let(
        {
          database: q.CreateDatabase({ name }),
          key: q.CreateKey({
            database: q.Select(['ref'], q.Var('database')),
            role: 'admin',
          }),
        },
        {
          secret: q.Select(['secret'], q.Var('key')),
          keyRef: q.Select(['ref'], q.Var('key')),
          dbRef: q.Select(['ref'], q.Var('database')),
        }
      )
    )

    keyRef = response.keyRef
    dbRef = response.dbRef

    console.info('--------- database created ', name)
    testClient = new getClient({ ...config, secret: response.secret })
  })

  test(
    'initiate schema',
    async () => {
      const { isSchemaUpdated } = await faunaDeploy({
        testClient,
        config: configForDeploy,
      })

      expect(isSchemaUpdated).toBeTruthy()

      const { collections, indexes, functions, roles } = await testClient.query(
        q.Let(
          {},
          {
            collections: q.Map(q.Paginate(q.Collections()), (ref) =>
              q.Get(ref)
            ),
            indexes: q.Map(q.Paginate(q.Indexes()), (ref) => q.Get(ref)),
            functions: q.Map(q.Paginate(q.Functions()), (ref) => q.Get(ref)),
            roles: q.Map(q.Paginate(q.Roles()), (ref) => q.Get(ref)),
          }
        )
      )

      const omitDynamicFields = ({ ts, ref, ...rest }) => rest

      expect(collections.data.map(omitDynamicFields)).toEqual([
        {
          history_days: 30,
          name: 'users',
          data: {
            ...defaultData,
            deletion_policy: 'retain',
          },
        },
        {
          history_days: 30,
          name: 'logs',
          data: defaultData,
        },
      ])

      expect(indexes.data.map(omitDynamicFields)).toEqual([
        {
          active: true,
          serialized: true,
          name: 'user_by_email',
          data: defaultData,
          source: [
            {
              collection: new values.Ref(
                'users',
                new values.Ref('collections')
              ),
            },
          ],
          terms: [
            {
              field: ['data', 'test'],
            },
          ],
          partitions: 1,
        },
      ])

      expect(functions.data.map(omitDynamicFields)).toEqual([
        {
          name: 'register',
          data: defaultData,
          body: BaseFQLValue,
        },
        {
          name: 'test_circular_dependency',
          data: defaultData,
          body: BaseFQLValue,
          role: new values.Ref(
            'test_circular_dependency',
            new values.Ref('roles')
          ),
        },
      ])

      expect(roles.data.map(omitDynamicFields)).toEqual([
        {
          name: 'test_circular_dependency',
          data: defaultData,
          membership: [
            {
              resource: new values.Ref('users', new values.Ref('collections')),
              predicate: BaseFQLValue,
            },
          ],
          privileges: [
            {
              resource: new values.Ref(
                'test_circular_dependency',
                new values.Ref('functions')
              ),
              actions: {
                call: true,
              },
            },
          ],
        },
        {
          name: 'customer',
          data: defaultData,
          membership: [
            {
              resource: new values.Ref('users', new values.Ref('collections')),
              predicate: BaseFQLValue,
            },
          ],
          privileges: [
            {
              resource: new values.Ref(
                'user_by_email',
                new values.Ref('indexes')
              ),
              actions: {
                read: true,
              },
            },
          ],
        },
      ])
    },
    3 * 60 * 1000
  )

  test('schema up to date', async () => {
    const { isSchemaUpdated } = await faunaDeploy({
      testClient,
      config: configForDeploy,
    })

    console.info(isSchemaUpdated)

    expect(isSchemaUpdated).toBeFalsy()
  })

  test(
    'update schema',
    async () => {
      const updateConfig = {
        ...configForDeploy,
        functions: configForDeploy.functions.map((fn) =>
          fn.name === 'register'
            ? {
                name: 'register',
                body: q.Query(q.Lambda('ref', q.Sum([q.Var('ref'), 1]))),
                role: 'admin',
                data: { update: 'test' },
              }
            : fn
        ),
      }

      await faunaDeploy({
        testClient,
        config: updateConfig,
      })

      const functions = await testClient.query(
        q.Map(q.Paginate(q.Functions()), (ref) => q.Get(ref))
      )

      expect(functions.data.length).toEqual(2)

      const { ts, ref, ...fn } = functions.data.find(
        (fn) => fn.name === 'register'
      )
      expect(fn).toEqual({
        name: 'register',
        role: 'admin',
        data: { update: 'test' },
        body: new values.Query({
          lambda: 'ref',
          expr: {
            sum: [{ var: 'ref' }, 1],
          },
          api_version: '4',
        }),
      })
    },
    3 * 60 * 1000
  )

  test('delete schema', async () => {
    const { collections, ...deleteSchema } = configForDeploy

    await faunaDeploy({
      testClient,
      config: deleteSchema,
    })

    const resp = await testClient.query(
      q.Map(q.Paginate(q.Collections()), (ref) => q.Get(ref))
    )

    expect(resp.data.length).toEqual(1)
    expect(resp.data[0].data.deletion_policy).toEqual('retain')
  })

  // afterAll(async () => {
  //   await rootClient.query(q.Do(q.Delete(keyRef), q.Delete(dbRef)))
  // })
})
function randomString(prefix) {
  var rand = ((Math.random() * 0xffffff) << 0).toString(16)
  return (prefix || '') + rand
}
