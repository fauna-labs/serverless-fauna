const { Client } = require("faunadb");

const clients = {};

function getClient({ secret, domain, port, scheme }) {
  const cacheKey = [domain + secret].join("/");

  if (!clients[cacheKey]) {
    clients[cacheKey] = new Client({
      secret,
      headers: { "X-Fauna-Source": "serverless-fauna" },
      ...(domain && { domain }),
      ...(port && { port }),
      ...(scheme && { scheme }),
    });
  }

  return clients[domain + secret];
}

module.exports = getClient;
module.exports.clients = clients;
