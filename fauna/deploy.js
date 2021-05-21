const { query: q, Expr } = require('faunadb')
const getClient = require('./client')
const { GetObjectFields, ExtractValues, ReplaceObject } = require('./utility')

module.exports = ({
  clientConfig,
  collections,
  indexes,
  functions,
  roles,
  successLog,
}) => {
  const client = getClient(clientConfig)
  const queries = [
    ...prepareQueries({ resources: collections, type: 'collection' }),
    ...prepareQueries({ resources: indexes, type: 'index' }),
    ...prepareQueries({ resources: functions, type: 'function' }),
    ...prepareQueries({ resources: roles, type: 'role' }),
  ]

  return queries
    .reduce(
      (memo, next) =>
        memo.then((schemaUpdated) =>
          client
            .query(next.query)
            .then((qRes) => {
              if (qRes) {
                successLog(qRes)
                return true
              }
              return schemaUpdated
            })
            .catch((errResp) => handleError({ errResp, name: next.name }))
        ),
      Promise.resolve()
    )
    .then((schemaUpdated) => {
      if (!schemaUpdated) {
        successLog('Schema up to date')
      }
    })
}

/**
 * Delete resources that not specified at configuration (unless resource has deleting_policy: retain)
 */
const DeleteResourcesIfNotInConfiguration = ({
  label,
  resources,
  ResourceList,
}) => {
  return q.Let(
    {
      deletedResource: q.Map(
        FilterResourceToBeDeleted({ ResourceList, resources }),
        q.Lambda('resource', q.Delete(q.Select(['ref'], q.Var('resource'))))
      ),
      resourceNames: q.Concat(
        q.Map(
          q.Filter(
            q.Var('deletedResource'),
            q.Lambda('resource', q.IsObject(q.Var('resource')))
          ),
          q.Lambda('resource', q.Select(['name'], q.Var('resource')))
        ),
        ', '
      ),
    },
    q.If(
      q.GT(q.Count(q.Var('deletedResource')), 0),
      q.Format('%s %s was deleted', label, q.Var('resourceNames')),
      null
    )
  )
}

const FilterResourceToBeDeleted = ({ ResourceList, resources }) => {
  return q.Filter(
    q.Map(
      q.Select(['data'], q.Paginate(ResourceList())),
      q.Lambda('resource', q.Get(q.Var('resource')))
    ),
    q.Lambda(
      'resource',
      q.And([
        q.Not(
          q.Equals(
            q.Select(['data', 'deletion_policy'], q.Var('resource'), ''),
            'retain'
          )
        ),
        q.Equals(
          q.Count(
            q.Intersection([[q.Select(['ref'], q.Var('resource'))], resources])
          ),
          0
        ),
      ])
    )
  )
}

const UpsertResource = ({ label, resource, ref, CreateQuery, UpdateQuery }) => {
  return q.Let(
    {
      name: q.Select(['name'], resource),
      isExists: q.Exists(ref),
      res: q.If(
        q.Var('isExists'),
        UpdateIfChanged({
          ref,
          resource,
          UpdateFql: UpdateQuery(ref, resource),
        }),
        CreateQuery(resource)
      ),
    },
    LogResult({
      label,
      res: q.Var('res'),
      isExists: q.Var('isExists'),
    })
  )
}

/**
 * Execute UpdateFql only if obj values not the same as at the db
 */
const UpdateIfChanged = ({ ref, resource, UpdateFql }) =>
  q.Let(
    {
      fields: GetObjectFields(resource),
      db: q.Get(ref),
      compareObj: ExtractValues({ obj: q.Var('db'), fields: q.Var('fields') }),
    },
    q.If(q.Equals([q.Var('compareObj'), resource]), '', UpdateFql)
  )

/**
 * Checks if readonly fields not modified and update all the rest
 * If readonly fields modified, abort and show proper message to a user
 */
const SafeUpdateWithReadonly = ({ ref, readonly, resource }) => {
  return q.Let(
    {
      db: q.Get(ref),

      // get set of readonly fields that specified at update object
      updateReadonlyFieldsNames: q.Intersection(
        readonly,
        GetObjectFields(resource)
      ),
      updateReadonlyFields: ExtractValues({
        obj: resource,
        fields: q.Var('updateReadonlyFieldsNames'),
      }),

      // prepare object to compare db values with update object values
      dbReadonlyFields: ExtractValues({
        obj: q.Var('db'),
        fields: q.Var('updateReadonlyFieldsNames'),
      }),

      // prepare secure update object (excluding readonly fields)
      // if we pass readonly fields, db would simple reject query with an error
      secureUpdateFieldsNames: q.Difference([
        GetObjectFields(resource),
        readonly,
      ]),
      secureUpdateFields: q.ToObject(
        q.Map(q.Var('secureUpdateFieldsNames'), (key) => [
          key,
          q.Select([key], resource),
        ])
      ),
    },
    q.If(
      q.Equals(q.Var('dbReadonlyFields'), q.Var('updateReadonlyFields')),
      // Update query will merge existing `data` with provided. However, when user remove
      // some fields from `data` config, he would expect that those fields would be removed from db
      // Replace query has a bug when trying to replace index.
      // It throw an error that `active` field is required, even if it was passed
      // As a temporarily solution, we set null value for each fields of `data` in database
      // and then merge with `data` from config
      q.Update(
        ref,
        q.Merge(q.Var('secureUpdateFields'), {
          data: ReplaceObject({
            newData: resource.data,
            currentData: q.Select(['data'], q.Var('db')),
          }),
        })
      ),
      q.Abort(q.Format('Field %s are readonly', q.Concat(readonly, ',')))
    )
  )
}

const LogResult = ({ res, isExists, label }) =>
  q.If(
    q.IsObject(res),
    q.Format(
      '%s `%s` was %s',
      label,
      q.Select(['name'], res),
      q.If(isExists, 'updated', 'created')
    ),
    null
  )

const handleError = ({ errResp, name }) => {
  if (!errResp.requestResult) throw errResp
  const error = errResp.requestResult.responseContent.errors[0]
  console.info(error)
  if (error.failures) {
    const failures = error.failures
      .map((f) => [`\`${f.field}\``, f.description].join(': '))
      .join('; ')
    throw new Error([name, failures].join(' => '))
  }

  throw new Error([name, error.description].join(' => '))
}

const ParamsMapByResourceType = {
  index: {
    Ref: q.Index,
    ResourceList: q.Indexes,
    CreateQuery: q.CreateIndex,
    UpdateQuery: (ref, resource) =>
      SafeUpdateWithReadonly({
        ref,
        resource,
        readonly: ['source', 'terms', 'values'],
      }),
  },
  function: {
    Ref: q.Function,
    ResourceList: q.Functions,
    CreateQuery: q.CreateFunction,
  },
  collection: {
    Ref: q.Collection,
    ResourceList: q.Collections,
    CreateQuery: q.CreateCollection,
  },
  role: { Ref: q.Role, ResourceList: q.Roles, CreateQuery: q.CreateRole },
}
const prepareQueries = ({ resources, type }) => {
  const params = ParamsMapByResourceType[type]

  return [
    ...resources.map((resource) => ({
      name: `upsert.${type}.${resource.name}`,
      query: UpsertResource({
        resource,
        ref: params.Ref(resource.name),
        label: type,
        CreateQuery: params.CreateQuery,
        UpdateQuery: params.UpdateQuery || q.Replace,
      }),
    })),
    {
      name: `delete.${type}`,
      query: DeleteResourcesIfNotInConfiguration({
        ResourceList: params.ResourceList,
        resources: resources.map(({ name }) => params.Ref(name)),
        label: type,
      }),
    },
  ]
}
