const clientProp = require("./client");
const collectionProp = require("./collection");
const indexProp = require("./index");
const functionProp = require("./function");
const roleProp = require("./role");

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
    indexes: {
      type: "object",
      patternProperties: {
        ".*": indexProp,
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
