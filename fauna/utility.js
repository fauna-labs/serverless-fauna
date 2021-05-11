const { query: q } = require('faunadb')

const GetObjectFields = (obj) =>
  q.Map(q.ToArray(obj), (el) => q.Select([0], el))

/**
 * Extract values from object by keys.
 * If obj doesn't have field, handle it gracefully and doesn't return it value
 */
const ExtractValues = ({ obj, fields }) =>
  q.ToObject(q.Map(fields, (ro) => [ro, q.Select([ro], obj, null)]))

const ReplaceObject = ({ newData = {}, currentData }) => {
  return q.Merge(
    q.ToObject(
      q.Map(
        GetObjectFields(currentData),
        q.Lambda('field', [q.Var('field'), null])
      )
    ),
    newData
  )
}

module.exports = { GetObjectFields, ExtractValues, ReplaceObject }
