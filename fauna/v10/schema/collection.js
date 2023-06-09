module.exports = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { type: "object" },
    history_days: { type: "integer" },
    ttl_days: { type: "integer" },
    constraints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          unique: { type: "array", items: { type: "string" } },
        },
      },
    },
    indexes: {
      type: "object",
      patternProperties: {
        ".*": {
          type: "object",
          additionalProperties: false,
          properties: {
            queryable: { type: "boolean" },
            terms: {
              type: "array",
              items: {
                type: "object",
                required: ["field"],
                additionalProperties: false,
                properties: {
                  field: { type: "string" },
                  mva: { type: "boolean" },
                },
              },
            },
            values: {
              type: "array",
              items: {
                type: "object",
                required: ["field"],
                additionalProperties: false,
                properties: {
                  field: { type: "string" },
                  order: { type: "string" },
                  mva: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
  },
};
