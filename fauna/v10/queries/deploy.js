const { fql } = require("fauna");

/**
 * Constructs an FQL Query to create/update a collection according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param preview A boolean indicating whether to preview or effect changes.
 * @returns A Query. The query returns an array of results:
 *          [{ type: "Collection", name: str, action: "created" | "updated", preview: bool}, ...]
 */
const createUpdateCollection = (params, preview = false) => {
  return fql`
  {
    let deleteKey = (key, obj) => {
      Object.fromEntries(Object.entries(obj).where(e => key != e[0]))
    }

    let cleanIndexes = (realIndexes, paramsIndexes) => {
      Object.fromEntries(Object.entries(realIndexes).map(e => {
        // Always remove status because users don't set it
        let newValue = deleteKey("status", e[1])

        // The queryable prop is always returned on an index, so remove it unless it's on params
        let newValue = if (paramsIndexes != null && paramsIndexes[e[0]] != null && paramsIndexes[e[0]].queryable == null) {
          deleteKey("queryable", newValue)
        } else {
          newValue
        }

        [e[0], newValue]
      }))
    }

    let deleteConstraintStatuses = (constraints) => {
      // Always remove status because users don't set it
      constraints.map(c => deleteKey("status", c))
    }

    let p = ${params}
    let p = p {
      name,
      indexes,
      constraints,
      data,
      ttl_days,
      history_days,
    }

    if (Collection.byName(p.name) == null) {
      let created = if (${preview}) {
        p
      } else {
        let c = Collection.create(p)
        c {
          name,
          indexes: cleanIndexes(c.indexes, p.indexes),
          constraints: deleteConstraintStatuses(c.constraints),
          data,
          ttl_days,
          history_days,
        }
      }

      [{ type: "Collection", name: p.name, action: "created", preview: ${preview}, result: created }]
    } else {
      let coll = Collection.byName(p.name)
      let original = coll {
        name,
        indexes: cleanIndexes(coll.indexes ?? {}, p.indexes),
        constraints: deleteConstraintStatuses(coll.constraints ?? []),
        data,
        ttl_days,
        history_days,
      }

      if (original != p) {
        if (${preview}) {
          [{ type: "Collection", name: p.name, action: "updated", preview: ${preview}, original: original, result: p }]
        } else {
          let updated = coll.replace(p)
          let updated = updated {
            name,
            indexes: cleanIndexes(updated.indexes, p.indexes),
            constraints: deleteConstraintStatuses(updated.constraints),
            data,
            ttl_days,
            history_days,
          }
          [{ type: "Collection", name: p.name, action: "updated", preview: ${preview}, original: original, result: updated }]
        }
      } else {
        []
      }
    }
  }`;
};

/**
 * Constructs an FQL Query to create/update functions according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param preview A boolean flag to indicate whether to mutate or just log.
 * @returns An FQL Query. The query returns an array of results:
 *          [{ type: "Function", name: str, action: "created" | "updated", preview: bool}, ...]
 */
const createUpdateFunction = (params, preview = false) => {
  return fql`
  {
    let p = ${params}
    let p = p { name, body, signature, data, role, }

    if (Function.byName(p.name) == null) {
      let created = if (${preview}) {
        p
      } else {
        Function.create(p) {
          name,
          body,
          signature,
          data,
          role,
        }
      }
      [{ type: "Function", name: p.name, action: "created", preview: ${preview}, result: created }]
    } else {
      let func = Function.byName(p.name)
      let original = func {
        name,
        body,
        signature,
        data,
        role,
      }

      if (original != p) {
        if (${preview}) {
          [{ type: "Function", name: p.name, action: "updated", preview: ${preview}, original: original, result: p }]
        } else {
          let updated = func.replace(p) {
            name,
            body,
            signature,
            data,
            role,
          }
          [{ type: "Function", name: p.name, action: "updated", preview: ${preview}, original: original, result: updated }]
        }
      } else {
        []
      }
    }
  }`;
};

/**
 * Constructs an FQL Query to create/update roles according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @param preview A boolean flag to indicate whether to mutate or just log.
 * @returns An FQL Query. The query returns an array of results:
 *          [{ type: "Role", name: str, action: "created" | "updated", preview: bool}, ...]
 */
const createUpdateRole = (params, preview = false) => {
  return fql`
  {
    let p = ${params}
    let p = p { name, membership, privileges, data, }

    if (Role.byName(p.name) == null) {
      let created = if (${preview}) {
        p
      } else {
        Role.create(p) {
          name,
          membership,
          privileges,
          data,
        }
      }

      [{ type: "Role", name: p.name, action: "created", preview: ${preview}, result: created }]
    } else {
      let role = Role.byName(p.name)
      let original = role {
        name,
        membership,
        privileges,
        data,
      }

      if (original != p) {
        if (${preview}) {
          [{ type: "Role", name: p.name, action: "updated", preview: ${preview}, original: original, result: p }]
        } else {
          let updated = role.replace(p) {
            name,
            membership,
            privileges,
            data,
          }
          [{ type: "Role", name: p.name, action: "updated", preview: ${preview}, original: original, result: updated }]
        }
      } else {
        []
      }
    }
  }`;
};

/**
 * Constructs an FQL Query used to deploy a schema in a single transaction.
 *
 * The query will be an array of individual queries, and will return the following contract:
 * ```
 * [
 *    [{ type: "Function", name: str, action: "created" | "updated", preview: bool}, ...],
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
 *   { type: "Function", name: "", action: "created" }
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let x = 1
 * { type: "Function", name: "", action: "created" }
 * ```
 *
 * @param An object containing definitions of each type of resource. E.g.
 *        {
 *          "functions": [{"name": "MyFunc", "body": "_ => 1", "role": "admin", "data": {"meta": "some metadata"}}],
 *          "collections": [{"name": "MyColl"}],
 *          "roles": [{"name": "MyColl"}],
 *        }
 * @returns An FQL Query
 */
module.exports = ({ collections = [], functions = [], roles = [] }) => {
  const queries = [
    ...collections.map((c) => createUpdateCollection(c)),
    ...functions.map((f) => createUpdateFunction(f)),
    ...roles.map((r) => createUpdateRole(r)),
  ];

  // The wire protocol doesn't yet support passing an array of queries, so
  // we can manually construct the string parts.
  const stringParts = ["[", ...queries.slice(0, -1).map((_) => ","), "]"];

  // Now pass the string parts and the queries to fql(), the backing function for fql``
  return fql(stringParts, ...queries);
};
