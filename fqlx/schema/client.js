module.exports = {
  type: "object",
  additionalProperties: false,
  required: ["secret"],
  properties: {
    secret: { type: "string" },
    endpoint: { type: "string" },
  },
};
