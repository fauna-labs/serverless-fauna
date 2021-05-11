const { query: q } = require('faunadb')
const getClient = require('./client')
const { GetObjectFields, ExtractValues } = require('./utility')

module.exports = ({ clientConfig, collections, indexes, functions }) => {
  const client = getClient(clientConfig)

  const queries = [
    ...prepareQueries({ resources: collections, type: 'collection' }),
    ...prepareQueries({ resources: indexes, type: 'index' }),
    ...prepareQueries({ resources: functions, type: 'function' }),
  ]

  return queries
    .reduce(
      (memo, next) =>
        memo.then((result) =>
          client
            .query(next.query)
            .then((qRes) => result.concat(qRes))
            .catch((errResp) => handleError({ errResp, name: next.name }))
        ),
      Promise.resolve([])
    )
    .then((result) => result.filter((r) => !!r))
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

const UpsertCollection = (collection) => {
  return q.Let(
    {
      name: q.Select(['name'], collection),
      ref: q.Collection(q.Var('name')),
      isExists: q.Exists(q.Var('ref')),
      res: q.If(
        q.Var('isExists'),
        UpdateIfChanged({
          ref: q.Var('ref'),
          obj: collection,
          UpdateFql: q.Replace(q.Var('ref'), collection),
        }),
        q.CreateCollection(collection)
      ),
    },
    LogResult({
      res: q.Var('res'),
      isExists: q.Var('isExists'),
      label: 'collection',
    })
  )
}

const UpsertFunction = (fn) => {
  return q.Let(
    {
      name: q.Select(['name'], fn),
      ref: q.Function(q.Var('name')),
      isExists: q.Exists(q.Var('ref')),
      res: q.If(
        q.Var('isExists'),
        UpdateIfChanged({
          ref: q.Var('ref'),
          obj: fn,
          UpdateFql: q.Replace(q.Var('ref'), fn),
        }),
        q.CreateFunction(fn)
      ),
    },
    LogResult({
      res: q.Var('res'),
      isExists: q.Var('isExists'),
      label: 'function',
    })
  )
}

const UpsertIndex = (index) => {
  return q.Let(
    {
      name: q.Select(['name'], index),
      ref: q.Index(q.Var('name')),
      isExists: q.Exists(q.Var('ref')),
      res: q.If(
        q.Var('isExists'),
        UpdateIfChanged({
          ref: q.Var('ref'),
          obj: index,
          UpdateFql: SafeUpdateWithReadonly({
            ref: q.Var('ref'),
            readonly: ['source', 'terms', 'values'],
            obj: index,
          }),
        }),
        q.CreateIndex(index)
      ),
    },
    LogResult({
      res: q.Var('res'),
      isExists: q.Var('isExists'),
      label: 'index',
    })
  )
}

/**
 * Execute UpdateFql only if obj values not the same as at the db
 */
const UpdateIfChanged = ({ ref, obj, UpdateFql }) =>
  q.Let(
    {
      fields: GetObjectFields(obj),
      db: q.Get(ref),
      compareObj: ExtractValues({ obj: q.Var('db'), keys: q.Var('fields') }),
    },
    q.If(q.Equals([q.Var('compareObj'), obj]), '', UpdateFql)
  )

/**
 * Checks if readonly fields not modified and update all the rest
 * If readonly fields modified, abort and show proper message to a user
 */
const SafeUpdateWithReadonly = ({ ref, readonly, obj }) =>
  q.Let(
    {
      db: q.Get(ref),

      // get set of readonly fields that specified at update object
      updateReadonlyFieldsNames: q.Intersection(readonly, GetObjectFields(obj)),
      updateReadonlyFields: ExtractValues({
        obj,
        keys: q.Var('updateReadonlyFieldsNames'),
      }),

      // prepare object to compare db values with update object values
      dbReadonlyFields: ExtractValues({
        obj: q.Var('db'),
        keys: q.Var('updateReadonlyFieldsNames'),
      }),

      // prepare secure update object (excluding readonly fields)
      // if we pass readonly fields, db would simple reject query with an error
      secureUpdateFieldsNames: q.Difference([
        q.Map(q.ToArray(obj), (a) => q.Select([0], a)),
        readonly,
      ]),
      secureUpdateFields: q.ToObject(
        q.Map(q.Var('secureUpdateFieldsNames'), (key) => [
          key,
          q.Select([key], obj),
        ])
      ),
    },
    // { db: q.Var('dbReadonlyFields'), up: q.Var('updateReadonlyFields') }
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
          data: ReplaceData({
            newData: obj.data,
            currentData: q.Select(['data'], q.Var('db')),
          }),
        })
      ),
      q.Abort(q.Format('Field %s are readonly', q.Concat(readonly, ',')))
    )
  )

const ReplaceData = ({ newData = {}, currentData }) => {
  return q.Merge(
    q.ToObject(
      q.Map(
        q.Map(
          q.ToArray(currentData),
          q.Lambda('el', q.Select([0], q.Var('el')))
        ),
        q.Lambda('key', [q.Var('key'), null])
      )
    ),
    newData
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

  if (error.failures) {
    const failures = error.failures
      .map((f) => [`\`${f.field}\``, f.description].join(': '))
      .join('; ')
    throw new Error([name, failures].join(' => '))
  }

  throw new Error([name, error.description].join(' => '))
}

const ParamsMapByResourceType = {
  index: { Ref: q.Index, Upsert: UpsertIndex, ResourceList: q.Indexes },
  function: {
    Ref: q.Function,
    Upsert: UpsertFunction,
    ResourceList: q.Functions,
  },
  collection: {
    Ref: q.Collection,
    Upsert: UpsertCollection,
    ResourceList: q.Collections,
  },
}
const prepareQueries = ({ resources, type }) => {
  const params = ParamsMapByResourceType[type]
  return [
    ...resources.map((resource) => ({
      name: `upsert.${type}.${resource.name}`,
      query: params.Upsert(resource),
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
