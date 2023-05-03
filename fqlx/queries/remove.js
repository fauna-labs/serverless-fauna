const { fql } = require('fauna')
const { removeFunctionsExcept }  = require('./function')

/**
 * Constructs an FQL Query used to delete schema in a single transaction, excluding the resources provided as an argument. The query will be an array of individual queries and will return the following contract when evaluated:
 * ```
 * [
 *    Set[{ type: "function", name: str, result: "deleted" }, ...],
 *    ...
 * ]
 * ```
 *
 * For developers, when adding additional queries, each must be runnable inside an array and should return the same contract.
 *
 * E.g. This will work:
 * ```
 * {
 *   let name = "MyFunc"
 *   [{ type: "function", name: name, result: "deleted" }].toSet()
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let name = "MyFunc"
 * [{ type: "function", name: name, result: "deleted" }].toSet()
 * ```
 *
 * @param An object containing arrays of resource definitions by type of resource to retain. E.g.
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
    removeFunctionsExcept(functions),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}
