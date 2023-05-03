const { fql } = require('fauna')

/**
 * Constructs an FQL Query to create/update a function according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @returns An FQL X Query. The query returns an object:
 *          { type: "function", name: str, result: "created" | "updated" | "noop" }
 */
const createUpdateFunction = (params) => {
  return fql`
  {
    let p = ${params}
    if (Function.byName(p.name) != null) {
      let f = Function.byName(p.name)
      if (Object.entries(p).every(v => v[1] == f[v[0]])) {
        { type: "function", name: p.name, result: "noop" }
      } else {
        if (p.data != f.data) {
          let pNullData = Object.assign(p, { data: null })
          f.update(pNullData)
        }
        f.update(p)
        { type: "function", name: p.name, result: "updated" }
      }
    } else {
      Function.create(${params})
      { type: "function", name: ${params.name}, result: "created" }
    }
  }`
}


/**
 * Constructs an FQL Query to remove Fauna Functions managed by this plugin, excluding
 * those passed as an argument.
 *
 * @param functions An array of function definitions that should be excluded from removal.
 * @returns A Query that deletes functions managed by this plugin. The query returns a Fauna
 *          Set: Set[{ type: "function", name: "MyDeletedFunc", result: "deleted" }, ...]
 */
const removeFunctionsExcept  = (functions) => {
  let names = functions.map(f => f.name)
  return fql`
  Function.where(
    f =>
      !${names}.includes(f.name) &&
      f.data?.deletion_policy != "retain" &&
      f.data?.created_by_serverless_plugin == "fauna:v10"
  ).order(.name).map(f => {
    f.delete()
    { type: "function", name: f.name, result: "deleted" }
  })`
}


module.exports = {
  createUpdateFunction,
  removeFunctionsExcept,
}