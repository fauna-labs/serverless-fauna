const { Client } = require('fauna')


function getFQLXClient({ secret, endpoint }) {
  endpoint = endpoint ? new URL(endpoint): undefined
  return new Client({
    secret,
    endpoint,
  })
}

module.exports = getFQLXClient
