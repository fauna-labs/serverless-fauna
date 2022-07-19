const { query: q, values } = require('faunadb')

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
      q.Select(['data', 'created_by_serverless_plugin'], resource, false),
      q.Equals(
        q.Select(['data', 'deletion_policy'], resource, 'destroy'),
        'destroy'
      ),
      CustomFilter ? CustomFilter(resource) : true,
    ])
  )
}

// This maps a YAML key to a function that produces a resource for that value.
// For example, in a role, the key "function: my_fun" would produce a resource
// of Function("my_fun").
const ResourceMap = {
  collection:  (name) => new values.Ref(name, new values.Ref("collections")),
  index:       (name) => new values.Ref(name, new values.Ref("indexes")),
  function:    (name) => new values.Ref(name, new values.Ref("functions")),
  collections: () => new values.Ref("collections"),
  databases:   () => new values.Ref("databases"),
  indexes:     () => new values.Ref("indexes"),
  roles:       () => new values.Ref("roles"),
  functions:   () => new values.Ref("functions"),
  keys:        () => new values.Ref("keys"),
}

module.exports = {
  FilterServerlessResourceWithDestroyPolicy,
  GetObjectFields,
  ExtractValues,
  ReplaceObject,
  ResourceMap,
  GetAllResourcesRefs,
}
