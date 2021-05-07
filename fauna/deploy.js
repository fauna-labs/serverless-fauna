const { query: q } = require('faunadb')
const client = require('./client')
const { GetObjectFields, ExtractValues } = require('./utility')

module.exports = ({ collections, indexes, functions }) => {
  const queries = [
    ...collections.map((collection) => ({
      name: `collection.${collection.name}`,
      query: UpsertCollection(collection),
    })),
    ...indexes.map((index) => ({
      name: `index.${index.name}`,
      query: UpsertIndex(index),
    })),
    ...functions.map((fn) => ({
      name: `function.${fn.name}`,
      query: UpsertFunction(fn),
    })),
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
          UpdateFql: q.Update(q.Var('ref'), fn),
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
      q.Update(ref, q.Var('secureUpdateFields')),
      q.Abort(q.Format('Field %s are readonly', q.Concat(readonly, ',')))
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

const handleError = ({ errResp, name }) => {
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
