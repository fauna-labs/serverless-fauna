const { fql } = require('fauna')
const { and } = require('./utils')

/**
 * Creates or updates a function according to the passed parameters.
 *
 * @param params The params to pass to the create or update call.
 * @returns An FQL X Query
 */
const createUpdateFunction = (params) => {
  return fql`
  let results = if (Function.byName(${params.name}) != null) {
    let f = Function.byName(${params.name})
    if (${and("f", params)}) {
      results.append({ type: "function", name: ${params.name}, result: "not changed" })
    } else {
      f.update(${params})
      results.append({ type: "function", name: ${params.name}, result: "updated" })
    }
  } else {
    Function.create(${params})
    results.append({ type: "function", name: ${params.name}, result: "created" })
  }`
}

module.exports = {
  createUpdateFunction
}