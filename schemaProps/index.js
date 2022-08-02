const sourceObjProp = {
  type: "object",
  required: ["collection"],
  additionalProperties: false,
  properties: {
    collection: { type: "string" },
    fields: {
      type: "object",
      patternProperties: {
        ".*": { type: "string" },
      },
    },
  },
};

const termsProp = {
  type: "object",
  properties: {
    fields: { type: "array", items: { type: "string" } },
    bindings: { type: "array", items: { type: "string" } },
  },
  oneOf: [{ required: ["fields"] }, { required: ["bindings"] }],
  additionalProperties: false,
};

const valueFieldProp = {
  type: "object",
  properties: {
    path: { type: "string" },
    reverse: { type: "boolean" },
  },
  required: ["path"],
  additionalProperties: false,
};

const valuesProp = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        oneOf: [{ type: "string" }, valueFieldProp],
      },
    },
    bindings: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

module.exports = {
  required: ["name", "source"],
  additionalProperties: false,
  type: "object",
  properties: {
    name: { type: "string" },
    active: { type: "boolean" },
    source: {
      oneOf: [
        { type: "string" },
        { type: "array", items: sourceObjProp },
        sourceObjProp,
      ],
    },
    unique: { type: "boolean" },
    serialized: { type: "boolean" },
    terms: termsProp,
    values: valuesProp,
    data: { type: "object" },
  },
};
