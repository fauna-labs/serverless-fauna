const { query: q, Expr, values } = require('faunadb')
const {
  GetObjectFields,
  ExtractValues,
  ReplaceObject,
  FilterServerlessResourceWithDestroyPolicy,
} = require('./utility')
const beautify = require('js-beautify');

// Converts a ref, such as Collection("foo") or Function("my_func"),
// into the variable name for said reference.
function ref_to_var(ref) {
  if (ref.collection.id === "collections") {
    return `collection-${ref.id}`
  } else if (ref.collection.id === "indexes") {
    return `index-${ref.id}`
  } else if (ref.collection.id === "functions") {
    return `function-${ref.id}`
  } else if (ref.collection.id === "roles") {
    return `role-${ref.id}`
  }
}
// Converts a ref into a human readable name. For example,
// Collection("foo") becomes "collection `foo`", and Function("my_func")
// becomes "function `my_func`"
function ref_to_log(ref) {
  if (ref.collection.id === "collections") {
    return `collection \`${ref.id}\``
  } else if (ref.collection.id === "indexes") {
    return `index \`${ref.id}\``
  } else if (ref.collection.id === "functions") {
    return `function \`${ref.id}\``
  } else if (ref.collection.id === "roles") {
    return `role \`${ref.id}\``
  }
}

// Returns the Create*() function for the type of ref.
// For example, Collection("foo") returns q.CreateCollection().
function create_function_for_ref(ref) {
  if (ref.collection.id === "collections") {
    return q.CreateCollection;
  } else if (ref.collection.id === "indexes") {
    return q.CreateIndex;
  } else if (ref.collection.id === "functions") {
    return q.CreateFunction;
  } else if (ref.collection.id === "roles") {
    return q.CreateRole;
  }
}

class Resources {
  constructor({ collections, indexes, functions, roles }) {
    this.collections = new Map(collections.map(collection => [collection.name, collection]));
    this.indexes = new Map(indexes.map(index => [index.name, index]));
    this.functions = new Map(functions.map(func => [func.name, func]));
    this.roles = new Map(roles.map(role => [role.name, role]));
  }

  // If any of these objects is in the configuration, then it will be part of our
  // massive Let() block. It also may have been created in this query, so we refer
  // to it by variable.
  ref(ref) {
    if (ref.collection.id === "collections") {
      if (this.collections.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Collection(name);
      }
    } else if (ref.collection.id === "indexes") {
      if (this.indexes.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Index(name);
      }
    } else if (ref.collection.id === "functions") {
      if (this.functions.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Function(name);
      }
    } else if (ref.collection.id === "roles") {
      if (this.roles.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Role(name);
      }
    } else {
      throw new Exception("cannot transform ref: " + ref);
    }
  }

  // Updates an index source, so that all collection refs will use
  // the Var(collection-name) when needed. Modifies source, and returns
  // the source.
  index_source(source) {
    // TODO: Read this: https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object
    for (const obj of source) {
      obj.collection = this.ref(obj.collection);
    }
    return source;
  }
  // Updates a role privileges list, so that all collection refs will use
  // the Var(collection-name) when needed, along with any other refs that
  // need to be transformed.
  role_privileges(privileges) {
    for (let privilege of privileges) {
      let resource = privilege.resource;
      // If the collection is undefined, it means this is a global ref,
      // like Functions() or Collections(). If the collection is present,
      // then it is a specific ref, like Function("my_func"). For specific
      // refs, we need to map those to Var("function-my_func"), in case
      // it was created in this query.
      if (resource.collection === undefined) {
        privilege.resource = resource;
      } else {
        privilege.resource = this.ref(resource);
      }
    }
    return privileges;
  }
}

class QueryBuilder {
  constructor({ resources }) {
    // A list of Let() blocks.
    this.sections = [{ result: "\n" }];
    // A Resources instance.
    this.resources = resources;
  }

  // Finishes the Let(), and returns a query block.
  finish() {
    return q.Let(this.sections, q.Var("result"));
  }

  // Creates a new let section. This will have the basic form of:
  // ```
  // If(
  //   Exists(ref),
  //   update,
  //   Select("ref", Create*(create)),
  // )
  // ```
  // This also creates another let section, which will log if the
  // update query or the create query was performed. Because of this,
  // the ref needs to be a collection, index, function, or role ref,
  // so that we can log it correctly.
  add({ ref, update, create }) {
    // First, clean up the create arguments
    for (const [key, value] of Object.entries(create)) {
      if (value === undefined) {
        delete create[key];
      }
    };
    let block = {};
    // We don't transform in Exists, as we haven't defined the variable yet.
    // Even in the second block, we don't want the variable, as we are trying
    // to log the result of the first block.
    block[ref_to_var(ref)] = q.If(
      q.Exists(ref),
      // TODO: Check if needs to update
      update,
      q.Select("ref", create_function_for_ref(ref)(create)),
    );
    this.sections.push(block);
    this.sections.push({
      result: q.If(
        q.Exists(ref),
        q.Concat([q.Var("result"), `updated ${ref_to_log(ref)}\n`]),
        q.Concat([q.Var("result"), `created ${ref_to_log(ref)}\n`]),
      ),
    });
  }
  add_update({ ref, update }) {
    // First, clean up the update arguments
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) {
        delete update[key];
      }
    };
    let block = {};
    const variable = ref_to_var(ref);
    block[variable] = q.If(
      // TODO: Check if needs to update
      true,
      q.Update(q.Var(variable), update),
      {},
    );
    this.sections.push(block);
    this.sections.push({
      result: q.If(
        // TODO: Check if needs to update
        true,
        q.Concat([q.Var("result"), `updated ${ref_to_log(ref)}\n`]),
        q.Var("result"),
      ),
    });
  }

  // Adds all the let sections to create collections.
  build_collections() {
    for (const [name, collection] of this.resources.collections) {
      this.add({
        ref: new values.Ref(name, new values.Ref("collections")),
        update: q.Collection(name),
        create: {
          name,
          data:         collection.data,
          history_days: collection.history_days,
          ttl:          collection.ttl,
          ttl_days:     collection.ttl_days,
          permissions:  collection.permissions,
        },
      });
    }
  }
  build_indexes(resources) {
    for (const [name, index] of this.resources.indexes) {
      this.add({
        ref: new values.Ref(name, new values.Ref("indexes")),
        update: q.Index(name),
        create: {
          name,
          source:      this.resources.index_source(index.source),
          terms:       index.terms,
          values:      index.values,
          unique:      index.unique,
          serialized:  index.serialized,
          permissions: index.permissions,
          data:        index.data,
          ttl:         index.ttl,
        },
      });
    }
  }
  build_empty_roles() {
    for (const [name, role] of this.resources.roles) {
      this.add({
        ref: new values.Ref(name, new values.Ref("roles")),
        update: q.Role(name),
        create: {
          name,
          // Empty privileges, so that we can create our functions first
          privileges: [],
          data:       role.data,
          ttl:        role.ttl,
        },
      });
    }
  }
  build_functions() {
    for (const [name, func] of this.resources.functions) {
      this.add({
        ref: new values.Ref(name, new values.Ref("functions")),
        update: q.Function(name),
        create: {
          name,
          body: func.body,
          data: func.data,
          // If it's a ref, transform it. If it's not, then it is either null, "admin", or "server".
          role: func.role instanceof values.Ref ? this.resources.ref(func.role) : func.role,
          ttl:  func.ttl,
        },
      });
    }
  }
  build_update_roles() {
    for (const [name, role] of this.resources.roles) {
      const ref = new values.Ref(name, new values.Ref("roles"));
      this.add_update({
        ref,
        update: {
          privileges: this.resources.role_privileges(role.privileges),
          membership: role.membership,
        }
      });
    }
  }
}

module.exports = ({
  collections = [],
  indexes = [],
  functions = [],
  roles = [],
}) => {
  const resources = new Resources({ collections, indexes, functions, roles });
  const builder = new QueryBuilder({ resources });

  builder.build_collections();
  builder.build_indexes();
  builder.build_empty_roles();
  builder.build_functions();
  builder.build_update_roles();

  let query = builder.finish();
  console.log(beautify.js(query.toFQL(), { indent_size: 2, keep_array_indentation: true }));
  return query;
}

/**
 * Delete resources that not specified at configuration (unless resource has deletion_policy: retain)
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
  return FilterServerlessResourceWithDestroyPolicy({
    resources: q.Map(
      q.Select(['data'], q.Paginate(ResourceList()), {}),
      (ref) => q.Get(ref)
    ),
    CustomFilter: (resource) =>
      q.Equals(
        q.Count(q.Intersection([[q.Select(['ref'], resource)], resources])),
        0
      ),
  })
}

const UpsertResource = ({
  label,
  resource,
  ref,
  CreateQuery,
  UpdateQuery,
  remapDataForCreate,
}) => {
  const data = remapDataForCreate ? remapDataForCreate(resource) : resource

  return q.Let(
    {
      name: q.Select(['name'], resource),
      isExists: q.Exists(ref),
      res: q.If(
        q.Var('isExists'),
        UpdateIfChanged({
          ref,
          resource,
          UpdateFql: UpdateQuery(ref, data),
        }),
        CreateQuery(data)
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
            currentData: q.Select(['data'], q.Var('db'), {}),
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
const prepareQueries = ({ resources, type, remapDataForCreate }) => {
  const params = ParamsMapByResourceType[type]

  return [
    prepareUpsert({ resources, type, remapDataForCreate, log: true }),
    {
      log: true,
      name: `delete.${type}`,
      query: DeleteResourcesIfNotInConfiguration({
        ResourceList: params.ResourceList,
        resources: resources.map(({ name }) => params.Ref(name)),
        label: type,
      }),
    },
  ]
}

const prepareUpsert = ({ resources, type, remapDataForCreate, log }) => {
  const params = ParamsMapByResourceType[type]

  const queries = resources.map((resource) => UpsertResource({
    resource,
    ref: params.Ref(resource.name),
    label: type,
    CreateQuery: params.CreateQuery,
    UpdateQuery: params.UpdateQuery || q.Replace,
    remapDataForCreate,
  }))

  return {
    name: `upsert.${type}`,
    log,
    query: q.Do(queries),
  }
}
