const { fql, Module } = require("fauna");

/**
 * Constructs an FQL Query to create/update a collection according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param dryrun A boolean flag to indicate whether to mutate or just log.
 * @returns An FQL X Query. The query returns an array of results:
 *          [{ type: "Collection", name: str, result: "created" | "updated", dryrun: bool}, ...]
 */
const createUpdateCollection = (params, dryrun = false) => {
  return fql`
  {
    let deleteKey = (key, obj) => {
      Object.fromEntries(Object.entries(obj).where(e => key != e[0]))
    }
    
    let deleteIndexStatuses = (indexes) => {
      Object.fromEntries(Object.entries(indexes).map(e => [e[0], deleteKey("status", e[1])]))
    }
    
    let deleteConstraintStatuses = (constraints) => {
      constraints.map(c => deleteKey("status", c))
    }
    
    let p = ${params}
    let p = p {
      name,
      indexes,
      constraints,
      data,
    }
   
    if (Collection.byName(p.name) != null) {
      let coll = Collection.byName(p.name)
      let original = coll {
        name,
        indexes: deleteIndexStatuses(coll.indexes ?? {}),
        constraints: deleteConstraintStatuses(coll.constraints ?? []),
        data,
      }
      
      if (original != p) {
        if (${dryrun}) {
          [{ type: "Collection", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: p }]
        } else {
          let updated = coll.replace(p)
          let updated = updated {
            name,
            indexes: deleteIndexStatuses(updated.indexes),
            constraints: deleteConstraintStatuses(updated.constraints),
            data,
          }
          [{ type: "Collection", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: updated }]
        }
      } else {
        []
      }
      
    } else {
      let created = if (${dryrun}) {
        p
      } else {
        let c = Collection.create(p)
        c {
          name,
          indexes: deleteIndexStatuses(c.indexes),
          constraints: deleteConstraintStatuses(c.constraints),
          data,
        }
      }

      [{ type: "Collection", name: p.name, action: "created", dryrun: ${dryrun}, result: created }]
    }
  }`;
};

/**
 * Constructs an FQL Query to create/update functions according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param dryrun A boolean flag to indicate whether to mutate or just log.
 * @returns An FQL X Query. The query returns an array of results:
 *          [{ type: "Function", name: str, result: "created" | "updated", dryrun: bool}, ...]
 */
const createUpdateFunction = (params, dryrun = false) => {
  return fql`
  {
    let p = ${params}
    let p = p { name, body, data, role, }
    
    if (Function.byName(p.name) != null) {
      let func = Function.byName(p.name)
      let original = func {
        name,
        body,
        data,
        role,
      }
      
      if (original != p) {
        if (${dryrun}) {
          [{ type: "Function", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: p }]
        } else {
          let updated = func.replace(p) {
            name,
            body,
            data,
            role,
          }
          [{ type: "Function", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: updated }]
        }
      } else {
        []
      }

    } else {
      let created = if (${dryrun}) {
        p
      } else {
        Function.create(p) {
          name,
          body,
          data,
          role,
        }
      }

      [{ type: "Function", name: p.name, action: "created", dryrun: ${dryrun}, result: created }]
    }
  }`;
};

/**
 * Constructs an FQL Query to create/update roles according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param dryrun A boolean flag to indicate whether to mutate or just log.
 * @returns An FQL X Query. The query returns an array of results:
 *          [{ type: "Role", name: str, result: "created" | "updated", dryrun: bool}, ...]
 */
const createUpdateRole = (params, dryrun = false) => {
  return fql`
  {
    let p = ${params}
    let p = p { name, membership, privileges, data, }
    
    if (Role.byName(p.name) != null) {
      let role = Role.byName(p.name)
      let original = role {
        name,
        membership,
        privileges,
        data,
      }
      
      if (original != p) {
        if (${dryrun}) {
          [{ type: "Role", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: p }]
        } else {
          let updated = role.replace(p) {
            name,
            membership,
            privileges,
            data,
          }
          [{ type: "Role", name: p.name, action: "updated", dryrun: ${dryrun}, original: original, result: updated }]
        }
      } else {
        []
      }

    } else {
      let created = if (${dryrun}) {
        p
      } else {
        Role.create(p) {
          name,
          membership,
          privileges,
          data,
        }
      }

      [{ type: "Role", name: p.name, action: "created", dryrun: ${dryrun}, result: created }]
    }
  }`;
};

/**
 * Constructs an FQL Query used to deploy a schema in a single transaction.
 *
 * The query will be an array of individual queries, and will return the following contract:
 * ```
 * [
 *    [{ type: "Function", name: str, result: "created" | "updated", dryrun: bool}, ...],
 *    ...
 * ]
 * ```
 *
 * For developers, when adding additional queries, each must be runnable inside an array and should return the same contract
 *
 * E.g. This will work:
 * ```
 * {
 *   let x = 1
 *   { type: "Function", name: "", result: "created" }
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let x = 1
 * { type: "Function", name: "", result: "created" }
 * ```
 *
 * @param An object containing definitions of each type of resource. E.g.
 *        {
 *          "functions": [{"name": "MyFunc", "body": "_ => 1", "role": "admin", "data": {"meta": "some metadata"}],
 *          "collections": not implemented,
 *          "roles": not implemented,
 *        }
 * @returns An FQL Query
 */
module.exports = ({
  collections = [],
  functions = [],
  roles = [],
  options = {},
}) => {
  const dryrun = options.dryrun ?? false;
  const queries = [
    ...collections.map((c) => createUpdateCollection(c, dryrun)),
    ...functions.map((f) => createUpdateFunction(f, dryrun)),
    ...roles.map((r) => createUpdateRole(r, dryrun)),
  ];

  // The wire protocol doesn't yet support passing an array of queries, so
  // we can manually construct the string parts.
  const stringParts = ["[", ...queries.slice(0, -1).map((_) => ","), "]"];

  // Now pass the string parts and the queries to fql(), the backing function for fql``
  return fql(stringParts, ...queries);
};
