const { fql } = require("fauna");

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
        if (${preview}) {
          [{ type: "Function", name: p.name, action: "updated", preview: ${preview}, original: original, result: p }]
        } else {
          let updated = func.replace(p) {
            name,
            body,
            data,
            role,
          }
          [{ type: "Function", name: p.name, action: "updated", preview: ${preview}, original: original, result: updated }]
        }
      } else {
        []
      }

    } else {
      let created = if (${preview}) {
        p
      } else {
        Function.create(p) {
          name,
          body,
          data,
          role,
        }
      }

      [{ type: "Function", name: p.name, action: "created", preview: ${preview}, result: created }]
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
 *          "functions": [{"name": "MyFunc", "body": "_ => 1", "role": "admin", "data": {"meta": "some metadata"}],
 *          "collections": not implemented,
 *          "roles": not implemented,
 *        }
 * @returns An FQL Query
 */
module.exports = ({ functions = [] }) => {
  const queries = [...functions.map((f) => createUpdateFunction(f))];

  // The wire protocol doesn't yet support passing an array of queries, so
  // we can manually construct the string parts.
  const stringParts = ["[", ...queries.slice(0, -1).map((_) => ","), "]"];

  // Now pass the string parts and the queries to fql(), the backing function for fql``
  return fql(stringParts, ...queries);
};
