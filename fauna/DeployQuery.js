const { query: q, Expr, values } = require('faunadb')
const {
  GetObjectFields,
  ExtractValues,
  ReplaceObject,
  FilterServerlessResourceWithDestroyPolicy,
} = require('./utility')

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
        return q.Collection(ref.id);
      }
    } else if (ref.collection.id === "indexes") {
      if (this.indexes.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Index(ref.id);
      }
    } else if (ref.collection.id === "functions") {
      if (this.functions.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Function(ref.id);
      }
    } else if (ref.collection.id === "roles") {
      if (this.roles.get(ref.id) !== undefined) {
        return q.Var(ref_to_var(ref));
      } else {
        return q.Role(ref.id);
      }
    } else {
      throw new Exception("cannot transform ref: " + ref);
    }
  }

  // Updates an index source, so that all collection refs will use
  // the Var(collection-name) when needed. Modifies source, and returns
  // the source.
  //
  // This returns the new sources, and does not mutate sources.
  index_source(source) {
    // TODO: Read this: https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object
    let new_source = [];
    for (const [i, obj] of source.entries()) {
      // Shallow copies obj
      let new_obj = { ...obj };
      new_obj.collection = this.ref(new_obj.collection);
      new_source.push(new_obj);
    }
    return new_source;
  }
  // Updates a role privileges list, so that all collection refs will use
  // the Var(collection-name) when needed, along with any other refs that
  // need to be transformed.
  //
  // This returns the new privileges, and does not mutate privileges.
  role_privileges(privileges) {
    let new_privileges = [];
    for (let privilege of privileges) {
      let new_privilege = { ...privilege };
      // If the collection is undefined, it means this is a global ref,
      // like Functions() or Collections(). If the collection is present,
      // then it is a specific ref, like Function("my_func"). For specific
      // refs, we need to map those to Var("function-my_func"), in case
      // it was created in this query.
      let resource = privilege.resource;
      if (resource.collection === undefined) {
        new_privilege.resource = resource;
      } else {
        new_privilege.resource = this.ref(resource);
      }
      new_privileges.push(new_privilege);
    }
    return new_privileges;
  }
  // Updates a role member list, so that all collection refs will use
  // the Var(collection-name) when needed, along with any other refs that
  // need to be transformed.
  //
  // This returns the new membership, and does not mutate membership.
  role_membership(membership) {
    let new_membership = [];
    for (let member of membership) {
      let new_member = { ...member };
      // Same logic as role_privileges
      let resource = member.resource;
      if (resource.collection === undefined) {
        new_member.resource = resource;
      } else {
        new_member.resource = this.ref(resource);
      }
      new_membership.push(new_member);
    }
    return new_membership;
  }
}

class QueryBuilder {
  constructor({ resources }) {
    // A list of Let() blocks.
    this.sections = [
      { result: "\n" },
    ];
    // A Resources instance.
    this.resources = resources;
  }

  // Finishes the Let(), and returns a query block.
  finish() {
    return q.Let(
      this.sections,
      {
        result: q.Var("result"),
      }
    );
  }

  // Creates a new let section. This will have the basic form of:
  // ```
  // If(
  //   Exists(ref),
  //   If(Equals(Get(ref), body), {}, Abort("differs!")),
  //   Select("ref", Create*(body)),
  // )
  // ```
  // This also creates another let section, which will log if the
  // update query or the create query was performed. Because of this,
  // the ref needs to be a collection, index, function, or role ref,
  // so that we can log it correctly.
  //
  // `keys_to_nullify` is a list of all the keys that need to be nullified
  // before being updated. This is usually only the `data` field, as Update()
  // will merge the new value with the old one unless we nullify it.
  create({ ref, body, check_body = null, keys_to_nullify }) {
    // First, clean up the query body
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) {
        delete body[key];
      }
    };
    if (check_body === null) {
      check_body = body;
    }
    // This variable is expensive to create, and used in logging, so we create
    // it before hand. If the ref doesn't exist, it will never be used, so we
    // just say that the ref is not updated.
    let block = {};
    block["is-updated-" + ref_to_var(ref)] = q.If(
      q.Exists(ref),
      q.Equals([
        q.Map(
          Object.keys(check_body),
          q.Lambda("key", q.Select(q.Var("key"), q.Get(ref), null))
        ),
        Object.values(check_body),
      ]),
      false, // won't be used, so this doesn't really matter
    );
    this.sections.push(block);

    block = {};
    // We don't transform in Exists, as we haven't defined the variable yet.
    // Even in the second block, we don't want the variable, as we are trying
    // to log the result of the first block.
    block[ref_to_var(ref)] = q.If(
      q.Exists(ref),
      q.If(
        q.Var("is-updated-" + ref_to_var(ref)),
        ref,
        // Because Update() merges objects, and we want to replace them, we need to set
        // all the fields we want to replace with `null`, so that we don't end up merging
        // data.
        q.Do(
          q.Update(
            ref,
            // Collect all the keys we want into an object where each value is null
            q.ToObject(
              q.Map(
                // This is all the keys in the database and in the schema
                q.Intersection(
                  // All the keys in the database
                  q.Map(q.ToArray(q.Get(ref)), q.Lambda("x", q.Select(0, q.Var("x")))),
                  // All the keys in the schema
                  keys_to_nullify,
                ),
                // Map each of those keys to null
                q.Lambda("x", [q.Var("x"), null])
              ),
            ),
          ),
          // Now we actually do the update.
          q.Update(
            ref,
            body,
          ),
          // Make sure to return the ref, as this is all within a Let block.
          ref,
        ),
      ),
      q.Select("ref", create_function_for_ref(ref)(body)),
    );
    this.sections.push(block);
    this.sections.push({
      result: q.If(
        q.Exists(ref),
        q.If(
          q.Var("is-updated-" + ref_to_var(ref)),
          q.Concat([q.Var("result"), `${ref_to_log(ref)} is up to date\n`]),
          q.Concat([q.Var("result"), `updated ${ref_to_log(ref)}\n`]),
        ),
        q.Concat([q.Var("result"), `created ${ref_to_log(ref)}\n`]),
      ),
    });
    // TODO: This is a much more readable way of handling errors, but it
    // doesn't abort the transaction. Need to fix this.
    /*
    this.sections.push({
      errors: q.If(
        q.Exists(ref),
        q.If(
          q.Var("is-updated-" + ref_to_var(ref)),
          q.Var("errors"), // no error if up to date
          q.Append( // error: not up to date, cannot update
            {
              ref_name: ref_to_log(ref),
              schema: body,
              database: q.Get(ref),
            },
            q.Var("errors"),
          ),
        ),
        q.Var("errors"), // no error if created
      ),
    });
    */
  }
  update({ ref, update }) {
    // First, clean up the update arguments
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) {
        delete update[key];
      }
    };
    let block = {};
    const variable = ref_to_var(ref);

    // This variable is expensive to create, and used in logging, so we create
    // it before hand. If the ref doesn't exist, it will never be used, so we
    // just say that the ref is not updated.
    block = {};
    block["is-updated-" + variable] = q.If(
      q.Exists(ref),
      q.Equals([
        q.Map(
          Object.keys(update),
          q.Lambda("key", q.Select(q.Var("key"), q.Get(ref), null))
        ),
        Object.values(update),
      ]),
      false, // won't be used, so this doesn't really matter
    );
    this.sections.push(block);

    block = {};
    block[variable] = q.If(
      q.Var("is-updated-" + variable),
      {},
      q.Select("ref", q.Update(q.Var(variable), update)),
    );
    this.sections.push(block);
    this.sections.push({
      result: q.If(
        q.Var("is-updated-" + variable),
        q.Concat([q.Var("result"), `${ref_to_log(ref)} is up to date\n`]),
        q.Concat([q.Var("result"), `updated ${ref_to_log(ref)}\n`]),
      ),
    });
  }

  // Adds all the let sections to create collections.
  build_collections() {
    for (const [name, collection] of this.resources.collections) {
      this.create({
        ref: new values.Ref(name, new values.Ref("collections")),
        body: {
          name,
          data:         collection.data,
          history_days: collection.history_days,
          ttl:          collection.ttl,
          ttl_days:     collection.ttl_days,
          permissions:  collection.permissions,
        },
        keys_to_nullify: ["data", "permissions"],
      });
    }
  }
  build_indexes(resources) {
    for (const [name, index] of this.resources.indexes) {
      this.create({
        ref: new values.Ref(name, new values.Ref("indexes")),
        body: {
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
        keys_to_nullify: ["data"],
      });
    }
  }
  build_empty_roles() {
    for (const [name, role] of this.resources.roles) {
      this.create({
        ref: new values.Ref(name, new values.Ref("roles")),
        body: {
          name,
          // Empty privileges, so that we can create our functions first
          privileges: [],
          data:       role.data,
          ttl:        role.ttl,
        },
        // Only validate that name, data, and ttl are matching if the document
        // is already present.
        check_body: {
          name,
          data:       role.data,
          ttl:        role.ttl,
        },
        keys_to_nullify: ["data"],
      });
    }
  }
  build_functions() {
    for (const [name, func] of this.resources.functions) {
      this.create({
        ref: new values.Ref(name, new values.Ref("functions")),
        body: {
          name,
          body: func.body,
          data: func.data,
          // If it's a ref, transform it. If it's not, then it is either null, "admin", or "server".
          role: func.role instanceof values.Ref ? this.resources.ref(func.role) : func.role,
          ttl:  func.ttl,
        },
        keys_to_nullify: ["data"],
      });
    }
  }
  build_update_roles() {
    for (const [name, role] of this.resources.roles) {
      const ref = new values.Ref(name, new values.Ref("roles"));
      this.update({
        ref,
        update: {
          privileges: this.resources.role_privileges(role.privileges),
          membership: this.resources.role_membership(role.membership || []),
        }
      });
    }
  }

  build_delete(set, resource_name, schema_resources) {
    // Each item we delete will produce a string, so we join that with `\n` to produce our log.
    this.sections.push({
      result: q.Concat([
        q.Var("result"),
        q.Concat(
          q.Select("data", q.Map(q.Paginate(set, { size: 10000 }), q.Lambda(
            "x",
            q.If(
              q.And(
                // We are deleting things, so this resource must not exist in the schema
                q.Not(q.ContainsValue(
                  q.Select("id", q.Var("x")),
                  Array.from(schema_resources.keys())
                )),
                // Make sure it was created by serverless
                q.Select(["data", "created_by_serverless_plugin"], q.Get(q.Var("x")), false),
                // Make sure we actually want it deleted
                q.Equals(q.Select(["data", "deletion_policy"], q.Get(q.Var("x")), "retain"), "destroy"),
              ),
              q.Let({
                name: q.Select("name", q.Get(q.Var("x"))),
              }, q.Do(
                q.Delete(q.Var("x")),
                q.Format(`deleted ${resource_name} \`%s\`\n`, q.Var("name")),
              )),
              "",
            )
          )),
        )),
      ]),
    });
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

  builder.build_delete(q.Collections(), "collection", resources.collections);
  builder.build_delete(q.Indexes(),     "index",      resources.indexes);
  builder.build_delete(q.Functions(),   "function",   resources.functions);
  builder.build_delete(q.Roles(),       "role",       resources.roles);

  builder.build_collections();
  builder.build_indexes();
  builder.build_empty_roles();
  builder.build_functions();
  builder.build_update_roles();

  return builder.finish();
}
