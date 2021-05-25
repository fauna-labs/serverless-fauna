const { env } = process

let testConfig
try {
  testConfig = require('../testConfig.json')
} catch (err) {
  testConfig = {
    domain: env.FAUNA_DOMAIN,
    scheme: env.FAUNA_SCHEME,
    port: env.FAUNA_PORT,
    secret: env.FAUNA_ROOT_KEY,
  }
}

module.exports = testConfig
