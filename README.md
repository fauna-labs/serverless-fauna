This repository contains unofficial patterns, sample code, and tools to help developers build more effectively with [Fauna][fauna]. All [Fauna Labs][fauna-labs] repositories are provided “as-is” and without support. By using this repository or its contents, you agree that this repository may never be officially supported and moved to the [Fauna organization][fauna-organization].

---

# Serverless Fauna

This [Serverless Framework][serverless-framework] plugin allows you to manage Fauna databases and resources directly in your `serverless.yml` file. You can integrate it into your test and CI/CD pipeliness to keep your databases in sync across multiple environments. Visit [this repository][serverless-fauna-example] for a sample application demonstrating how to create, update, and delete collections, indexes, roles, and user-defined functions (UDFs).

- [Serverless Fauna](#serverless-fauna)
  - [Installation](#installation)
  - [Commands](#commands)
  - [Configuration](#configuration)
    - [Collection configuration](#collection-configuration)
    - [Function configuration](#function-configuration)
    - [Index configuration](#index-configuration)
      - [Index source](#index-source)
      - [Index terms](#index-terms)
      - [Index values](#index-values)
      - [Index binding](#index-binding)
    - [Role configuration](#role-configuration)
      - [Role schema privileges](#role-schema-privileges)
      - [Role membership](#role-membership)
  - [Deletion policy](#deletion-policy)

## Installation

```bash
$ npm install @fauna-labs/serverless-fauna --save-dev
```

or using yarn

```bash
$ yarn add @fauna-labs/serverless-fauna
```

> NOTE: This package has not reached a 1.0 release yet. Minor version releases may still contain breaking changes. If you wish, you can restrict your projects to only accepting patch updates by prefacing the version number with a `"~"` in your `package.json` file. For example, `"~0.2.0"` or `"~0.1.6"`

This is a plugin for [serverless](serverless-framework), and supports version 3 and above. For serverless 2, install `serverless-fauna` version 0.1.6.

## FQL v10 (beta)

FQL v10 resources follow a different schema than v4. You must declare your v4 and v10 resources in separate files. Specify a v10 schema by setting `version: 10`, like so:

```
plugins:
  - "@fauna-labs/serverless-fauna"

fauna:
  version: 10
  client:
    secret: ${env:FAUNA_SECRET}
    endpoint: ${env:FAUNA_ENDPOINT}

  collections:
    MyCollection:
      indexes:
        MyIndex:
          terms:
            - field: name
          values:
            - field: name
              order: asc

  functions:
    MyFunction:
      body: |
        x => x + 1

  roles:
    MyRole:
      privileges:
        - resource: MyFunction
          actions:
            call: true
        - resource: MyCollection
          actions:
            read: x => x.category == "pets"
```

You still use `sls fauna deploy` and `remove` commands to create, update and destroy this schema.

### Supported FQL v10 Resources

- [Functions](https://fqlx-beta--fauna-docs.netlify.app/fqlx/beta/reference/schema_entities/function/document_definition)
- [Collections with indexes and constraints](https://fqlx-beta--fauna-docs.netlify.app/fqlx/beta/reference/schema_entities/collection/document_definition)
- [Roles](https://fqlx-beta--fauna-docs.netlify.app/fqlx/beta/reference/auth/role/document_definition)

### Notable Differences

- You don't declare a separate `name` property on your config. Instead, the key is used as the name.
- Create and Update actions during a deploy command are handled in a single transaction. If, for some reason, your schema is large enough to cause an error, you should break it up into separate logical files for deployment.
- Destruction of resources during a deploy command is handled as a single separate transaction following creates/updates.

### Migrating to FQL v10

The v10 and v4 plugins exclusively remove resources associated with their versions. Even so, we recommend you update the `deletion_policy` to `retain` during an upgrade. Updating ensures that subsequent deploys won't remove a critical resource if a step is missed.

This makes the upgrade path fairly simple:

E.g.

1. Start with a v4 schema, `serverless.yml`.
2. Update the `deletion_policy` to `retain` and deploy it.

```
fauna:
  deletion_policy: retain
  collections:
    Movies:
      name: Movies
    Series:
      name: Series
```

2. Create a v10 schema, `serverless-v10.yml`

```
fauna:
  version: 10
  collections:
    Movies: {}
```

3. Update to v10 by running `sls fauna deploy -c serverless-v10.yml`.

   You should see this resource updated. Now, the collection metadata tells the plugin that it's managed by a v10 schema.

4. Remove `Movies` from `serverless.yml`.

   NOTE: If you run `sls fauna deploy -c serverless.yml` without removing `Movies`, the metadata will be updated again to tell the plugin it's managed by a v4 schema.

## Commands

This plugin listens to hooks from default serverless commands, and runs its own logic.

| command          | description                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| sls fauna deploy | Sync Fauna resources specified in the config. All resources created by the plugin have a property `created_by_serverless_plugin` |
| sls fauna remove | Remove Fauna resources managed by the plugin. [read more about deleting policy](#deletion_policy)                                |

## FQL v4 Configuration

```yaml
plugins:
  - "@fauna-labs/serverless-fauna"

fauna:
  client:
    secret: ${env:FAUNA_ROOT_KEY}
    # domain: db.fauna.com
    # port: 443
    # scheme: https
  collections:
    Movies:
      name: Movies
      data:
        some_data_key: some_data_value

  functions:
    double:
      name: double
      body: ${file(./double.fql)}

  indexes:
    movies_by_type:
      name: movies_by_type
      source: ${self:fauna.collections.Movies.name}
      terms:
        fields:
          - data.type

    movies_by_category:
      name: movies_by_category
      source: ${self:fauna.collections.Movies.name}
      data:
        some_data_key: some_data_value
      terms:
        fields:
          - data.category

    sort_by_year:
      name: sort_by_year
      source: ${self:fauna.collections.Movies.name}
      values:
        fields:
          - data.type
          - ref
```

### FQL v4 Collection configuration

Accepts the same params as Fauna's [`CreateCollection` query](https://docs.fauna.com/fauna/current/api/fql/functions/createcollection?lang=javascript#param_object)

```yaml
collections:
  Movies:
    name: Movies
    history_days: 30
    ttl_days: 10
    data:
      some_data_key: some_data_value
```

### FQL v4 Function configuration

Accepts the same params as Fauna's [`CreateFunction` query](https://docs.fauna.com/fauna/current/api/fql/functions/createfunction?lang=javascript)

```yaml
functions:
  double:
    name: double
    body: ${file(./double.fql)}
    role: admin
    data:
      desc: double number
```

### FQL v4 Index configuration

Accepts the same params as Fauna's [`CreateIndex` query](https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object).

In Fauna's indexes, `terms`, `values` and `source` can only be set during index creation. If you try to modify those fields in an existing index, the plugin will throw an error.

```yaml
search_by_category_and_sort_by_year:
  name: search_by_category_and_sort_by_year
  source:
    collection: ${self:fauna.collections.Movies.name}
    fields:
      is_current_year: ${file(./IsCurrentYear.fql)}
  terms:
    fields: -data.category
  values:
    fields:
      - path: data.type
        reverse: true
      - ref
    bindings:
      - is_current_year
```

#### FQL v4 Index source

The index source could be a string, and will be interpreted as collection reference.

```yaml
source: Movie
```

Or it could be a [source object](https://docs.fauna.com/fauna/current/api/fql/indexes?lang=javascript#source)

```yaml
source:
  collection: Movie
```

Or it could be an array of objects:

```yaml
source:
  - collection: Movies
  - collection: Cartoons
  - collection: Series
```

#### FQL v4 Index terms

Index terms describe the fields that should be searchable.

```yaml
terms:
  fields:
    - data.search
  bindings:
    - binding
```

#### FQL v4 Index values

Index values describe the fields returned, and have a similar structure to `terms`, but with an additional `reverse` field to define sort order.

```yaml
values:
  fields:
    - path: data.field
      reverse: true
  bindings:
    - binding
```

#### FQL v4 Index binding

[Index bindings](https://docs.fauna.com/fauna/current/tutorials/indexes/bindings) allow you to compute fields for a source while the document is being indexed.

You can specify multiline FQL:

```yaml
source:
  collection: Movies
  fields:
    is_current_year: >
      Equals([
        Year(Now()),
        ToInteger(Select(['data', 'release_year'], Var('doc')))
      ])
```

Or you can create file with the `.fql` extension, and use the [Fauna VSCode plugin](https://marketplace.visualstudio.com/items?itemName=fauna.fauna) to handle your `.fql` files.

```yaml
source:
  collection: Movies
  fields:
    is_current_year: ${file(./IsCurrentYear.fql)}
```

### FQL v4 Role configuration

Accepts the same params as Fauna's [`CreateRole` query](https://docs.fauna.com/fauna/current/api/fql/functions/createrole?lang=javascript).

```yaml
roles:
  movies_reader:
    name: movies_reader
    privileges:
      - collection: ${self:fauna.collections.movies.name}
        actions:
          read: true
      - index: ${self:fauna.indexes.movies_by_type.name}
        actions:
          read: true
      - function: ${self:fauna.functions.double.name}
        actions:
          call: true
```

#### FQL v4 Role schema privileges

Read more about the [privilege configuration object](https://docs.fauna.com/fauna/current/security/roles#pco)

For schema privileges, specify a field key without a value:

```yaml
roles:
  read_collections_and indexes:
    name: read_collections
    privileges:
      - collections:
        actions:
          read: true
      - indexes:
        actions:
          read: true
```

You can also pass action predicates:

```yaml
editors:
  name: editors
  membership:
    - ${self:fauna.collections.scriptwriters.name}
    - ${self:fauna.collections.directors.name}
  privileges:
    - collection: ${self:fauna.collections.movies.name}
      actions:
        read: true
        write: ${file(./CanModifyMovie.fql)}
```

#### Role membership

A membership configuration object dynamically defines which authenticated resources are members of a given role.

It could be a string:

```yaml
roles:
  actor:
    name: actor
    membership: actor
```

Or it could be an array:

```yaml
roles:
  actor:
    name: participant
    membership:
      - actor
      - directors
```

Or you could pass the full [membership object](https://docs.fauna.com/fauna/current/security/roles#mco)

```yaml
roles:
  only_active:
    name: only_active
    membership:
      resource: ${self:fauna.collections.users.name}
      predicate: ${file(./IsActiveUser.fql)}
```

Or even an array of membership objects:

```yaml
roles:
  only_active:
    name: only_granted
    membership:
      - resource: ${self:fauna.collections.users.name}
        predicate: ${file(./IsGranted.fql)}
      - resource: ${self:fauna.collections.managers.name}
        predicate: ${file(./IsGranted.fql)}
```

## Deletion policy

This plugin keeps your Fauna database in sync with your serverless configuration file. Therefore, the plugin will remove any resources that currently exist in Fauna, but are not declared in your serverless.com configuration file.

If there are resources that you absolutely do not want deleted, even though they might not be in your serverless.com configuration, you can set `deletion_policy` to `retain` (the default being `destroy`) in the top level `fauna` or `fqlx` configuration. In example below, Fauna resources will not be deleted:

```yaml
fauna:
  deletion_policy: retain
```

Please note that if you specify the `deletion_policy` at both the top level and the resource level, the resource level `deletion_policy` will override it. For example, in the following configuration, the collection `logs` would be removed and the rest of the resources would be saved:

```yaml
fauna:
  deletion_policy: retain
collections:
  Movies:
    name: Movies
  logs:
    name: logs
    deletion_policy: destroy
```

# Developers

To develop on this repository, clone it and make any changes you would like to issue in a pull request.

You can run the test suite by:

1. Starting a local fauna container with `docker run --rm --name faunadb-sls-test -p 8443:8443 fauna/faunadb`
2. Running the test suite with `npm test`

---

Copyright Fauna, Inc. or its affiliates. All rights reserved. SPDX-License-Identifier: MIT-0

[fauna]: https://www.fauna.com/
[fauna-labs]: https://github.com/fauna-labs
[fauna-organization]: https://github.com/fauna
[serverless-framework]: https://serverless.com
[serverless-framework-example]: https://github.com/fauna-labs/serverless-fauna-example
