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
      { type: "function", name: ${params.name}, result: "not changed" }
    } else {
      f.update(${params})
      { type: "function", name: ${params.name}, result: "updated" }
    }
  } else {
    Function.create(${params})
    { type: "function", name: ${params.name}, result: "created" }
  }`
}

module.exports = {
  createUpdateFunction
}