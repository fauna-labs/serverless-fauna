const { Client } = require('fauna')


function getFQLXClient({ secret, endpoint }) {
  return new Client({
    secret,
    endpoint: new URL(endpoint),
  })
}

module.exports = getFQLXClient
