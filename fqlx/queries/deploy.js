const { fql } = require('fauna')
const { createUpdateFunction }  = require('./function')


/**
 * Constructs an FQL Query used to deploy a schema in a single transaction.
 *
 * The query will be an array of individual queries returning the following contract:
 * ```
 * [
 *    { type: "function", name: str, result: "created" | "updated" | "noop" },
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
 *   { type: "function", name: "", result: "noop" }
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let x = 1
 * { type: "function", name: "", result: "noop" }
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
    ...functions.map(f => createUpdateFunction(f)),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}
