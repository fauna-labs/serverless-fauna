const { Client } = require('faunadb')

const client = new Client({
  secret: process.env.FAUNA_ROOT_KEY,
  ...(process.env.FAUNA_DOMAIN && { domain: process.env.FAUNA_DOMAIN }),
  ...(process.env.FAUNA_PORT && { domain: process.env.FAUNA_PORT }),
  ...(process.env.FAUNA_SCHEME && { domain: process.env.FAUNA_SCHEME }),
})

module.exports = client
