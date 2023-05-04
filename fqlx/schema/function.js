module.exports = {
  type: 'object',
  required: ['body'],
  additionalProperties: false,
  properties: {
    body: { type: 'string' },
    data: { type: 'object' },
    role: { type: 'string' },
  },
}
