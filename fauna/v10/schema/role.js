module.exports = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { type: "object" },
    membership: {
      type: "array",
      items: {
        type: "object",
        required: ["resource"],
        additionalProperties: false,
        properties: {
          resource: { type: "string" },
          predicate: { type: "string" },
        },
      },
    },
    privileges: {
      type: "array",
      items: {
        type: "object",
        required: ["resource", "actions"],
        additionalProperties: false,
        properties: {
          resource: { type: "string" },
          actions: {
            type: "object",
            additionalProperties: false,
            properties: {
              read: { type: "boolean" },
              write: { type: "boolean" },
              create: { type: "boolean" },
              delete: { type: "boolean" },
              history_read: { type: "boolean" },
              history_write: { type: "boolean" },
              call: { type: "boolean" },
            },
          },
        },
      },
    },
  },
};
