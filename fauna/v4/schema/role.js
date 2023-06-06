const membershipProp = {
  type: "object",
  required: ["resource"],
  additionalProperties: false,
  properties: {
    resource: { type: "string" },
    predicate: { type: "string" },
  },
};

const actionType = { anyOf: [{ type: "boolean" }, { type: "string" }] };

const rolePrivilegeSchemaActionsProp = {
  type: "object",
  additionalProperties: false,
  properties: {
    read: actionType,
    write: actionType,
    create: actionType,
    delete: actionType,
    history_read: actionType,
    history_write: actionType,
  },
};

const rolePrivilegeCollectionActionsProp = {
  type: "object",
  additionalProperties: false,
  properties: {
    read: actionType,
    write: actionType,
    create: actionType,
    delete: actionType,
    history_read: actionType,
    history_write: actionType,
    unrestricted_read: actionType,
  },
};

const rolePrivilegeFunctionActionsProp = {
  type: "object",
  additionalProperties: false,
  properties: {
    call: actionType,
  },
};

const rolePrivilegeIndexActionsProp = {
  type: "object",
  additionalProperties: false,
  properties: {
    unrestricted_read: actionType,
    read: actionType,
  },
};

const rolePrivilegeProp = {
  type: "object",
  additionalProperties: false,
  properties: {
    collection: { type: "string" },
    index: { type: "string" },
    function: { type: "string" },
    // following fields has type `boolean` as a workaround that allow use format like:
    // indexes:
    indexes: { type: "boolean" },
    collections: { type: "boolean" },
    databases: { type: "boolean" },
    roles: { type: "boolean" },
    functions: { type: "boolean" },
    keys: { type: "boolean" },
    actions: {
      anyOf: [
        rolePrivilegeSchemaActionsProp,
        rolePrivilegeCollectionActionsProp,
        rolePrivilegeFunctionActionsProp,
        rolePrivilegeIndexActionsProp,
      ],
    },
  },
};

module.exports = {
  type: "object",
  additionalProperties: false,
  required: ["name", "privileges"],
  properties: {
    name: { type: "string" },
    membership: {
      anyOf: [
        { type: "string" },
        { type: "array", items: { type: "string" } },
        membershipProp,
        { type: "array", items: membershipProp },
      ],
    },
    privileges: {
      type: "array",
      items: rolePrivilegeProp,
    },
  },
};
