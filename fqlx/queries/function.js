const { fql } = require('fauna')

/**
 * Creates or updates a function according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @returns An FQL X Query
 */
const createUpdateFunction = (params) => {
  return fql`
  if (Function.byName(${params.name}) != null) {
    let f = Function.byName(${params.name})
    if (Object.entries(${params}).every(v => v[1] == f[v[0]])) {
      { type: "function", resources: [${params.name}], action: "update", result: "noop" }
    } else {
      let p = ${params}
      let del = Object.entries(f.data ?? {})
        .map(v => if ((p.data ?? {})[v[0]] == null) v[0])
        .filter(v => v != null)

      let p = Object.assign(p, { data: Object.assign((p.data ?? {}),Object.fromEntries(del.map(k => [k, null]))) })
      f.update(p)
      { type: "function", resources: [${params.name}], action: "update", result: "updated" }
    }
  } else {
    Function.create(${params})
    { type: "function", resources: [${params.name}], action: "create", result: "created" }
  }`
}


const removeFunctionsExcept  = (functions) => {
  // This is wrapped in braces to all its inclusion in an array, e.g. fql`[ removeFunctionsExcept(funcs) ]`
  let names = functions.map(f => f.name)
  return fql`
  {
    let funcs = Function.where(
      f => 
        !${names}.includes(f.name) && 
        f.data?.deletion_policy != "retain" &&
        f.data?.created_by_serverless_plugin == "fauna:v10"
    ).map(f => f.delete())
    
    { type: "function", resources: funcs, action: "delete", result: "deleted" }
  }`
}


module.exports = {
  createUpdateFunction,
  removeFunctionsExcept,
}