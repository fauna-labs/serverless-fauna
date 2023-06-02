const { fql, Module } = require("fauna");

/**
 * Constructs an FQL Query to remove resources managed by this plugin, excluding
 * those passed as an argument.
 *
 * @param module
 * @param resources An array of definitions that should be excluded from removal.
 * @param dryrun A boolean flag to indicate whether to remove or just log.
 * @returns A Query that deletes resources managed by this plugin. The query returns an array of arrays
 *          E.g. [[{ type: "Function", name: "MyDeletedFunc", result: "deleted", dryrun: false}, ...], ...]
 */
const removeExcept = (module, resources, dryrun = false) => {
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
      if (!${dryrun}) {
        f.delete()
      }
      [{ type: mod.toString(), name: f.name, action: "deleted", dryrun: ${dryrun}}]
    })
  }`;
};

/**
 * Constructs an FQL Query used to delete schema in a single transaction, excluding the resources provided as an argument.
 * The query will be an array of individual queries, and will return the following contract when evaluated:
 * ```
 * [
 *    [{ type: "function", name: str, result: "deleted" }, ...],
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
 *   [[{ type: "function", name: name, result: "deleted" }]]
 * }
 * ```
 *
 * E.g. This will not work:
 * ```
 * let name = "MyFunc"
 * [[{ type: "function", name: name, result: "deleted" }]]
 * ```
 *
 * @param An object containing arrays of resource definitions by type of resource to retain. E.g.
 *        {
 *          "functions": [{"name": "MyFunc", "body": "_ => 1", "role": "admin", "data": {"meta": "some metadata"}],
 *          "collections": [...],
 *          "roles": [...],
 *        }
 * @returns An FQL Query
 */
module.exports = ({
  collections = [],
  functions = [],
  roles = [],
  options = {},
}) => {
  const dryrun = options.dryrun ?? false;

  const queries = [
    removeExcept(new Module("Collection"), collections, dryrun),
    removeExcept(new Module("Function"), functions, dryrun),
    removeExcept(new Module("Role"), roles, dryrun),
  ];

  // The wire protocol doesn't yet support passing an array of queries, so
  // we can manually construct the string parts.
  const stringParts = ["[", ...queries.slice(0, -1).map((_) => ","), "]"];

  // Now pass the string parts and the queries to fql(), the backing function for fql``
  return fql(stringParts, ...queries);
};
