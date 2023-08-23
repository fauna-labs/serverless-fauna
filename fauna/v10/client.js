const { Client } = require("fauna");

function getV10Client({ secret, endpoint, scheme, port, domain }) {
  if (endpoint != null && (scheme != null || port != null || domain != null)) {
    throw new Error(
      "Configure the client with `endpoint` or `schema`, `domain` and `port`, but not both."
    );
  }

  if (endpoint == null && scheme == null && port == null && domain == null) {
    return new Client({
      secret,
    });
  } else if (endpoint != null) {
    return new Client({
      endpoint: new URL(endpoint),
      secret,
    });
  } else {
    scheme = scheme ?? "https";
    port = port ?? 443;
    domain = domain ?? "db.fauna.com";
    return new Client({
      endpoint: new URL(`${scheme}://${domain}:${port}`),
      secret,
      typecheck: false,
    });
  }
}

module.exports = getV10Client;
