const { query: q } = require('faunadb')
const {
  GetAllResourcesRefs,
  FilterServerlessResourceWithDestroyPolicy,
} = require('./utility')

module.exports = () => {
  return q.Let(
    {
      resources: q.Map(GetAllResourcesRefs(), (ref) => q.Get(ref)),
      mustBeDeleted: FilterServerlessResourceWithDestroyPolicy({
        resources: q.Var('resources'),
      }),
      deleted: q.Map(q.Var('mustBeDeleted'), (resource) =>
        q.Delete(q.Select(['ref'], resource))
      ),
    },
    q.Map(q.Var('deleted'), (resource) => q.Select(['ref'], resource))
  )
}
