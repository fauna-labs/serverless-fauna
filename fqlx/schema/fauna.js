const clientProp = require("./client");
const functionProp = require("./function");
const roleProp = require("./role");
const collectionProp = require("./collection");

module.exports = {
  type: "object",
  required: ["client"],
  additionalProperties: false,
  properties: {
    client: clientProp,
    deletion_policy: { type: "string" },
    collections: {
      type: "object",
      patternProperties: {
        ".*": collectionProp,
      },
    },
    functions: {
      type: "object",
      patternProperties: {
        ".*": functionProp,
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
