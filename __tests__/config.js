const { env } = process

let testConfig
try {
  testConfig = require('../testConfig.json')
} catch (err) {
  testConfig = {
    domain: env.FAUNA_DOMAIN || "localhost",
    scheme: env.FAUNA_SCHEME || "http",
    port: env.FAUNA_PORT || "8443",
    secret: env.FAUNA_ROOT_KEY || "secret",
  }
}

module.exports = testConfig
