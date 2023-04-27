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

const GetAllResourcesRefs = () =>
  q.Let(
    {
      collections: q.Select(['data'], q.Paginate(q.Collections()), {}),
      indexes: q.Select(['data'], q.Paginate(q.Indexes()), {}),
      functions: q.Select(['data'], q.Paginate(q.Functions()), {}),
      roles: q.Select(['data'], q.Paginate(q.Roles()), {}),
    },
    q.Union(
      q.Var('indexes'),
      q.Var('collections'),
      q.Var('functions'),
      q.Var('roles')
    )
  )

const FilterServerlessResourceWithDestroyPolicy = ({
  resources,
  CustomFilter,
}) => {
  return q.Filter(resources, (resource) =>
    q.And([
      q.Or(
        q.Equals(
          q.Select(['data', 'created_by_serverless_plugin'], resource, ""),
          'fauna:v4'
        ),
        q.Equals(q.Select(['data', 'created_by_serverless_plugin'], resource, false), true)
      ),
      q.Equals(
        q.Select(['data', 'deletion_policy'], resource, 'destroy'),
        'destroy'
      ),
      CustomFilter ? CustomFilter(resource) : true,
    ])
  )
}

const ResourceMap = {
  collection: q.Collection,
  index: q.Index,
  function: q.Function,
  collections: q.Collections,
  databases: q.Databases,
  indexes: q.Indexes,
  roles: q.Roles,
  functions: q.Functions,
  keys: q.Keys,
}

module.exports = {
  FilterServerlessResourceWithDestroyPolicy,
  GetObjectFields,
  ExtractValues,
  ReplaceObject,
  ResourceMap,
  GetAllResourcesRefs,
}
