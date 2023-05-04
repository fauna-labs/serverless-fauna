const clientProp = require('./client')
const functionProp = require('./function')

module.exports = {
  type: 'object',
  required: ['client'],
  additionalProperties: false,
  properties: {
    client: clientProp,
    deletion_policy: { type: 'string' },
    functions: {
      type: 'object',
      patternProperties: {
        '.*': functionProp,
      },
    },
  },
}
