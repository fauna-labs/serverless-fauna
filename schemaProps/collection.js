module.exports = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    data: { type: 'object' },
    history_days: { type: 'integer' },
    ttl_days: { type: 'integer' },
  },
}
