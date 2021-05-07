function Logger(serverless) {
  const entity = 'Fauna'
  const levelColor = {
    info: 'yellow',
    error: 'red',
    success: 'green',
  }
  return new Proxy(
    {},
    {
      get: (_, prop) => (msg) =>
        serverless.cli.log(msg, entity, { color: levelColor[prop] }),
    }
  )
}

module.exports = Logger
