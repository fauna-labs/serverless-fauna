const clientProp = require("./client");
const functionProp = require("./function");
const collectionProp = require("./collection");
const roleProp = require("./role");

module.exports = {
  type: "object",
  required: ["client"],
  additionalProperties: false,
  properties: {
    version: {},
    client: clientProp,
    deletion_policy: { type: "string" },
    functions: {
      type: "object",
      patternProperties: {
        ".*": functionProp,
      },
    },
    collections: {
      type: "object",
      patternProperties: {
        ".*": collectionProp,
      },
    },
    roles: {
      type: "object",
      patternProperties: {
        ".*": roleProp,
      },
    },
  },
};
