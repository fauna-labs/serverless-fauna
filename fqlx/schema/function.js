module.exports = {
  type: 'object',
  required: ['name', 'body'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    body: { type: 'string' },
    data: { type: 'object' },
    role: { type: 'string' },
  },
}
