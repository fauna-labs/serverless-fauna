const { fql, Module } = require('fauna')

/**
 * Constructs an FQL Query to create/update resources according to the passed parameters.
 *
 * @param module The Module to create or update. E.g. Module("Collection")
 * @param params The params to pass to the create or update call.
 * @returns An FQL X Query. The query returns an object:
 *          { type: "Function", name: str, result: "created" | "updated" | "noop" }
 */
const createUpdate = (module, params) => {
  return fql`
  {
    let p = ${params}
    let mod = ${module}
    if (mod.byName(p.name) != null) {
      let f = mod.byName(p.name)
      if (Object.entries(p).every(v => v[1] == f[v[0]])) {
        { type: mod.toString(), name: p.name, result: "noop" }
      } else {
        if (p.data != f.data) {
          let pNullData = Object.assign(p, { data: null })
          f.update(pNullData)
        }
        f.update(p)
        { type: mod.toString(), name: p.name, result: "updated" }
      }
    } else {
      mod.create(p)
      { type: mod.toString(), name: p.name, result: "created" }
    }
  }`
}

/**
 * Constructs an FQL Query used to deploy a schema in a single transaction.
 *
 * The query will be an array of individual queries returning the following contract:
 * ```
 * [
 *    { type: "Function", name: str, result: "created" | "updated" | "noop" },
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
 *   { type: "Function", name: "", result: "noop" }
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let x = 1
 * { type: "Function", name: "", result: "noop" }
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
  functions = [],
}) => {
  const queries = [
    ...functions.map(f => createUpdate(new Module("Function"), f)),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}

