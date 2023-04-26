const { Client } = require('fauna')

const clients = {}

function getFQLXClient({ secret, endpoint }) {
  const cacheKey = `${secret}/${endpoint}`

  if (!clients[cacheKey]) {
    clients[cacheKey] = new Client({
      secret,
      endpoint: new URL(endpoint),
    })
  }

  return clients[cacheKey]
}

module.exports = getFQLXClient
module.exports.clients = clients
