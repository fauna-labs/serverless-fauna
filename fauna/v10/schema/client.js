module.exports = {
  type: "object",
  additionalProperties: false,
  required: ["secret"],
  properties: {
    secret: { type: "string" },
    domain: { type: "string" },
    scheme: { type: "string" },
    port: { type: "number" },
    endpoint: { type: "string" },
  },
};
