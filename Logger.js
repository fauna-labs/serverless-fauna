function Logger(cli) {
  const entity = "Fauna";
  const levelColor = {
    warn: "yellow",
    info: "white",
    error: "red",
    success: "green",
  };
  return new Proxy(
    {},
    {
      get: (_, prop) => (msg) =>
        cli.log(msg, entity, { color: levelColor[prop] }),
    }
  );
}

module.exports = Logger;
