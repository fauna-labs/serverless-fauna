module.exports = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string" },
    signature: { type: "string" },
    data: { type: "object" },
    role: { type: "string" },
  },
};
