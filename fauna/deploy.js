const { query: q } = require('faunadb')
const client = require('./client')
const { GetObjectFields, ExtractValues } = require('./utility')

module.exports = ({ collections, indexes }) => {
  const queries = [
    {
      name: 'collections',
      query: UpsertCollections(collections),
    },
    {
      name: 'indexes',
      query: UpsertIndexes(indexes),
    },
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

const UpsertCollections = (collections) => {
  return q.Map(collections, (collection) =>
    q.Let(
      {
        name: q.Select(['name'], collection),
        ref: q.Collection(q.Var('name')),
        isExists: q.Exists(q.Var('ref')),
        res: q.If(
          q.Var('isExists'),
          UpdateIfChanged({
            ref: q.Var('ref'),
            obj: collection,
            UpdateFql: q.Update(q.Var('ref'), collection),
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
  )
}

const UpsertIndexes = (indexes) => {
  return q.Map(indexes.map(mapIndex), (index) =>
    q.Let(
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
              label: 'index',
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
const SafeUpdateWithReadonly = ({ ref, readonly, obj, label }) =>
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
      q.Update(ref, q.Var('secureUpdateFields')),
      q.Abort(
        q.Format(
          'Field %s are readonly. Check %s `%s`',
          q.Concat(readonly, ','),
          label,
          q.Select(['name'], obj)
        )
      )
    )
  )

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

const mapIndex = (index) => {
  const source = (Array.isArray(index.source)
    ? index.source
    : [index.source]
  ).map(({ collection, fields }) => {
    if (fields) throw new Error("index doesn't `source.fields` yet")

    return { collection: q.Collection(collection) }
  })
  return {
    ...index,
    source,
  }
}

const handleError = ({ errResp, name }) => {
  console.info(errResp)
  const error = errResp.requestResult.responseContent.errors[0]
  const title = `Can't create '${name}'`

  if (error.failures) {
    const failures = error.failures
      .map((f) => [`\`${f.field}\``, f.description].join(': '))
      .join('; ')
    throw new Error([title, failures].join(' => '))
  }

  throw new Error([title, error.description].join(' => '))
}
