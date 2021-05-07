const { query: q } = require('faunadb')

const GetObjectFields = (obj) =>
  q.Map(q.ToArray(obj), (el) => q.Select([0], el))

/**
 * Extract values from object by keys.
 * If obj doesn't have field, handle it gracefully and doesn't return it value
 */
const ExtractValues = ({ obj, keys }) =>
  q.ToObject(
    q.Filter(
      q.Map(keys, (ro) => [ro, q.Select([ro], obj, null)]),
      (el) => q.Not(q.IsNull(q.Select([1], el)))
    )
  )

module.exports = { GetObjectFields, ExtractValues }
