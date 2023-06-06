const { fql, Module } = require("fauna");

/**
 * Constructs an FQL Query to remove resources managed by this plugin, excluding
 * those passed as an argument.
 *
 * @param module
 * @param resources An array of definitions that should be excluded from removal.
 * @param preview A boolean flag to indicate whether to remove or just log.
 * @returns A Query that deletes resources managed by this plugin. The query returns an array of arrays
 *          E.g. [{ type: "Function", name: "MyDeletedFunc", action: "deleted", preview: false}, ...]
 */
const removeExcept = (module, resources, preview = false) => {
  let names = resources.map((f) => f.name);
  return fql`
  {
    let mod = ${module}
    mod.where(
      f =>
        !${names}.includes(f.name) &&
        f.data?.deletion_policy == "destroy" &&
        f.data?.created_by_serverless_plugin == "fauna:v10"
    ).order(.name).toArray().map(f => {
      if (!${preview}) {
        f.delete()
      }
      { type: mod.toString(), name: f.name, action: "deleted", preview: ${preview}}
    })
  }`;
};

/**
 * Constructs an FQL Query used to delete schema in a single transaction, excluding the resources provided as an argument.
 * The query will be an array of individual queries, and will return the following contract when evaluated:
 * ```
 * [
 *    [{ type: "function", name: str, action: "deleted" }, ...],
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
 *   [{ type: "function", name: name, action: "deleted" }]
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let name = "MyFunc"
 * [{ type: "function", name: name, action: "deleted" }]
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
module.exports = ({ functions = [] }) => {
  const queries = [removeExcept(new Module("Function"), functions)];

  // The wire protocol doesn't yet support passing an array of queries, so
  // we can manually construct the string parts.
  const stringParts = ["[", ...queries.slice(0, -1).map((_) => ","), "]"];

  // Now pass the string parts and the queries to fql(), the backing function for fql``
  return fql(stringParts, ...queries);
};
