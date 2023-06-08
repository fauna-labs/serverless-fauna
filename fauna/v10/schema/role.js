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
              read: {},
              write: {},
              create: {},
              delete: {},
              history_read: {},
              history_write: {},
              call: {},
            },
          },
        },
      },
    },
  },
};
