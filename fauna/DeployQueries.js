const { query: q, Expr, values } = require('faunadb')
const {
  GetObjectFields,
  ExtractValues,
  ReplaceObject,
  FilterServerlessResourceWithDestroyPolicy,
} = require('./utility')

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
  collection(name) {
    if (name === null) {
      return name;
    } else if (this.collections.get(name) !== undefined) {
      return q.Var(`collection-${name}`);
    } else {
      return q.Collection(name);
    }
  }
  index(name) {
    if (name === null) {
      return name;
    } else if (this.indexes.get(name) !== undefined) {
      return q.Var(`index-${name}`);
    } else {
      return q.Index(name);
    }
  }
  func(name) {
    if (name === null) {
      return name;
    } else if (this.functions.get(name) !== undefined) {
      return q.Var(`function-${name}`);
    } else {
      return q.Function(name);
    }
  }
  role(name) {
    if (name === null) {
      return name;
    } else if (this.roles.get(name) !== undefined) {
      return q.Var(`role-${name}`);
    } else {
      return q.Role(name);
    }
  }

  // Updates an index source, so that all collection refs will use
  // the Var(collection-name) when needed. Modifies source, and returns
  // the source.
  index_source(source) {
    // TODO: Read this: https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object
    for (const obj of source) {
      obj.collection = this.collection(obj.collection.id);
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
      } else if (resource.collection.id === "collections") {
        privilege.resource = this.collection(resource.id);
      } else if (resource.collection.id === "indexes") {
        privilege.resource = this.index(resource.id);
      } else if (resource.collection.id === "functions") {
        privilege.resource = this.func(resource.id);
      } else if (resource.collection.id === "roles") {
        privilege.resource = this.role(resource.id);
      } else {
        throw new Exception("invalid resource: " + resource);
      }
    }
    return privileges;
  }
}

module.exports = ({
  collections = [],
  indexes = [],
  functions = [],
  roles = [],
}) => {
  const resources = new Resources({ collections, indexes, functions, roles });

  let let_sections = [
    ...build_collections(resources),
    ...build_indexes(resources),
    ...build_empty_roles(resources),
    ...build_functions(resources),
    ...update_roles(resources),
  ];
  let query = q.Let(let_sections, {});
  console.log(query.toFQL());
  return query;
}

function build_collections(resources) {
  let let_blocks = [];
  for (const [name, collection] of resources.collections) {
    let block = {};
    block[`collection-${name}`] = q.If(
      q.Exists(q.Collection(name)),
      q.Collection(name),
      q.Select("ref", q.CreateCollection({
        name,
        data:         collection.data,
        history_days: collection.history_days,
        ttl:          collection.ttl,
        ttl_days:     collection.ttl_days,
        permissions:  collection.permissions,
      })),
    );
    let_blocks.push(block);
  }
  return let_blocks;
}

function build_indexes(resources) {
  let let_blocks = [];
  for (const [name, index] of resources.indexes) {
    console.log("SOURCE", index.source);
    let block = {};
    block[`index-${name}`] = q.If(
      q.Exists(q.Index(name)),
      q.Index(name),
      q.Select("ref", q.CreateIndex({
        name,
        source:      resources.index_source(index.source),
        terms:       index.terms,
        values:      index.values,
        unique:      index.unique,
        serialized:  index.serialized,
        permissions: index.permissions,
        data:        index.data,
        ttl:         index.ttl,
      })),
    );
    let_blocks.push(block);
  }
  return let_blocks;
}

function build_empty_roles(resources) {
  let let_blocks = [];
  for (const [name, role] of resources.roles) {
    let block = {};
    block[`role-${name}`] = q.If(
      q.Exists(q.Role(name)),
      q.Role(name),
      q.Select("ref", q.CreateRole({
        name,
        // Empty privileges, so that we can create our functions first
        privileges: [],
        data:       role.data,
        ttl:        role.ttl,
      })),
    );
    let_blocks.push(block);
  }
  return let_blocks;
}

function build_functions(resources) {
  let let_blocks = [];
  for (const [name, func] of resources.functions) {
    let block = {};
    block[`function-${name}`] = q.If(
      q.Exists(q.Function(name)),
      q.Function(name),
      q.Select("ref", q.CreateFunction({
        name,
        body: func.body,
        data: func.data,
        // If it's a ref, transform it. If it's not, then it is either null, "admin", or "server".
        role: typeof func.role === values.Ref ? resources.role(func.role.id) : func.role,
        ttl:  func.ttl,
      })),
    );
    let_blocks.push(block);
  }
  return let_blocks;
}

function update_roles(resources) {
  let let_blocks = [];
  for (const [name, role] of resources.roles) {
    let block = {};
    block[""] = q.Update(
      resources.role(name),
      {
        privileges: resources.role_privileges(role.privileges),
        membership: role.membership,
      }
    );
    let_blocks.push(block);
  }
  return let_blocks;
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
