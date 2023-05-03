const { fql, Module } = require('fauna')

/**
 * Constructs an FQL Query to remove resources managed by this plugin, excluding
 * those passed as an argument.
 *
 * @param module
 * @param resources An array of definitions that should be excluded from removal.
 * @returns A Query that deletes functions managed by this plugin. The query returns a Fauna
 *          Set: Set[{ type: "Function", name: "MyDeletedFunc", result: "deleted" }, ...]
 */
const removeExcept  = (module, resources) => {
  let names = resources.map(f => f.name)
  return fql`
  {
    let mod = ${module}
    mod.where(
      f =>
        !${names}.includes(f.name) &&
        f.data?.deletion_policy != "retain" &&
        f.data?.created_by_serverless_plugin == "fauna:v10"
    ).order(.name).map(f => {
      f.delete()
      { type: mod.toString(), name: f.name, result: "deleted" }
    })
  }`
}

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
    removeExcept(new Module("Function"), functions),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}
