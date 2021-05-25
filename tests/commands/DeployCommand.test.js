const DeployCommand = require('../../commands/DeployCommand')
const fauna = require('faunadb')
const Logger = require('../../Logger')
const { query: q, Expr } = fauna

describe('DeployCommand', () => {
  const logger = new Logger({
    log: () => jest.fn(),
  })

  describe('Adapters', () => {
    let command
    const faunaClient = { query: jest.fn().mockResolvedValue() }
    const faunaDeploy = jest.fn().mockResolvedValue()

    const BaseFQL = q.Lambda('ref', q.Var('ref'))
    const BaseFQLString = Expr.toString(BaseFQL)

    beforeAll(() => {
      command = new DeployCommand({
        faunaClient,
        config: {},
        logger,
        faunaDeploy,
      })
    })

    describe('FunctionAdapter', () => {
      const fn = {
        name: 'test',
        body: BaseFQLString,
        data: { prop: 'prop' },
      }

      const compare = {
        name: 'test',
        role: null,
        body: q.Query(BaseFQL),
        data: { prop: 'prop' },
      }

      test('base', () => {
        expect(command.functionAdapter(fn)).toEqual(compare)
      })

      test('with build-in role', () => {
        expect(command.functionAdapter({ ...fn, role: 'admin' })).toEqual({
          ...compare,
          role: 'admin',
        })
      })

      test('with custom role', () => {
        expect(command.functionAdapter({ ...fn, role: 'custom' })).toEqual({
          ...compare,
          role: q.Role('custom'),
        })
      })
    })

    describe('IndexAdapter', () => {
      test('source', () => {
        const cases = [
          {
            label: 'plain string',
            input: { name: 'name', source: 'source' },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
            },
          },
          {
            label: 'array of strings',
            input: { name: 'name', source: ['source', 'source2'] },
            output: {
              name: 'name',
              source: [
                {
                  collection: q.Collection('source'),
                },
                {
                  collection: q.Collection('source2'),
                },
              ],
            },
          },
          {
            label: 'source object',
            input: {
              name: 'name',
              source: { collection: 'source', fields: { bind: BaseFQLString } },
            },
            output: {
              name: 'name',
              source: [
                {
                  collection: q.Collection('source'),
                  fields: {
                    bind: q.Query(BaseFQL),
                  },
                },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })

      test('terms', () => {
        const cases = [
          {
            label: 'only fields',
            input: {
              name: 'name',
              source: 'source',
              terms: { fields: ['data.field1', 'data.field2'] },
            },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
              terms: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
              ],
            },
          },
          {
            label: 'with binding',
            input: {
              name: 'name',
              source: 'source',
              terms: {
                fields: ['data.field1', 'data.field2'],
                bindings: ['bind'],
              },
            },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
              terms: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
                { binding: 'bind' },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })

      test('values', () => {
        const cases = [
          {
            label: 'only fields',
            input: {
              name: 'name',
              source: 'source',
              values: { fields: ['data.field1', 'data.field2'] },
            },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
              values: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
              ],
            },
          },
          {
            label: 'with binding',
            input: {
              name: 'name',
              source: 'source',
              values: {
                fields: ['data.field1', 'data.field2'],
                bindings: ['bind'],
              },
            },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
              values: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
                { binding: 'bind' },
              ],
            },
          },
          {
            label: 'with reverse',
            input: {
              name: 'name',
              source: 'source',
              values: {
                fields: [{ path: 'data.field1', reverse: true }],
              },
            },
            output: {
              name: 'name',
              source: [{ collection: q.Collection('source') }],
              values: [{ field: ['data', 'field1'], reverse: true }],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })
    })

    describe('RoleAdapter', () => {
      test('boolean privileges', () => {
        expect(
          command.roleAdapter({
            name: 'name',
            privileges: [
              {
                index: 'index',
                actions: { read: true },
              },
              {
                function: 'function',
                actions: { read: true },
              },
              {
                databases: null,
                actions: { read: true },
              },
              {
                keys: null,
                actions: { read: true },
              },
            ],
          })
        ).toEqual({
          name: 'name',
          privileges: [
            { resource: q.Index('index'), actions: { read: true } },
            { resource: q.Function('function'), actions: { read: true } },
            { resource: q.Databases(), actions: { read: true } },
            { resource: q.Keys(), actions: { read: true } },
          ],
        })
      })

      test('predicate privileges', () => {
        expect(
          command.roleAdapter({
            name: 'name',
            privileges: [
              { collection: 'collection', actions: { read: BaseFQLString } },
            ],
          })
        ).toEqual({
          name: 'name',
          privileges: [
            {
              resource: q.Collection('collection'),
              actions: { read: q.Query(BaseFQL) },
            },
          ],
        })
      })

      test('membership', () => {
        const cases = [
          {
            label: 'plain string',
            input: {
              name: 'name',
              membership: 'membership',
              privileges: [
                { collection: 'collection', actions: { read: true } },
              ],
            },
            output: {
              name: 'name',
              privileges: [
                {
                  resource: q.Collection('collection'),
                  actions: { read: true },
                },
              ],
              membership: [{ resource: q.Collection('membership') }],
            },
          },

          {
            label: 'membership object',
            input: {
              name: 'name',
              membership: {
                resource: 'membership',
                predicate: BaseFQLString,
              },
              privileges: [
                { collection: 'collection', actions: { read: true } },
              ],
            },
            output: {
              name: 'name',
              privileges: [
                {
                  resource: q.Collection('collection'),
                  actions: { read: true },
                },
              ],
              membership: [
                {
                  resource: q.Collection('membership'),
                  predicate: q.Query(BaseFQL),
                },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.roleAdapter(input), label).toEqual(output)
        }
      })
    })

    describe('Deploy', () => {
      const command = new DeployCommand({
        faunaClient,
        faunaDeploy,
        logger,
        config: {
          collections: { users: { name: 'users' } },
          indexes: {
            user_by_email: { name: 'user_by_email', source: 'users' },
          },
          functions: {
            register: { name: 'register', body: BaseFQLString },
          },
          roles: {
            customer: {
              name: 'customer',
              membership: { resource: 'users', predicate: BaseFQLString },
              privileges: [{ index: 'user_by_email', actions: { read: true } }],
            },
          },
        },
      })

      command.deploy({
        faunaClient,
      })

      expect(faunaDeploy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          faunaClient,
          collections: [{ name: 'users' }],
          indexes: [
            {
              name: 'user_by_email',
              source: [{ collection: q.Collection('users') }],
            },
          ],
          functions: [{ name: 'register', body: q.Query(BaseFQL), role: null }],
          roles: [
            {
              name: 'customer',
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
        })
      )
    })
  })
})
