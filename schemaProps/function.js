module.exports = {
  type: 'object',
  required: ['name', 'body'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    deletion_policy: { type: 'string' },
    body: { type: 'string' },
    data: { type: 'object' },
    role: { type: 'string' },
  },
}
