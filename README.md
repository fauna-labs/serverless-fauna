This repository contains unofficial patterns, sample code, or tools to help developers build more effectively with [Fauna][fauna]. All [Fauna Labs][fauna-labs] repositories are provided “as-is” and without support. By using this repository or its contents, you agree that this repository may never be officially supported and moved to the [Fauna organization][fauna-organization].

---

# Serverless Fauna

This [Serverless Framework][serverless-framework] plugin allows you to manage Fauna databases and resources directly in your `serverless.yml` file. You can integrate it in your test and CI/CD pipeliness to keep your databases in sync across multiple environments. Visit [this repository][serverless-fauna-example] for a sample application that demonstrates how to create, update, and delete collections, indexes, roles, and user-defined functions (UDFs).

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

> NOTE: This package has not reached a 1.0 release yet.  Minor version releases may still contain breaking changes.  If you wish, you can restrict your projects to only accepting patch updates by prefacing the version number with a `"~"` in your `package.json` file.  For example, `"~0.2.0"` or `"~0.1.6"`

## Commands 
This plugin listens to hooks from default serverless commands, and runs its own logic:

| command | description |
| --- | --- |
| serverless deploy | sync Fauna resources specified a config. All resources created by the plugin has boolean property `created_by_serverless_plugin` set to `true` |
| serverless remove | sync Fauna resources created by plugin [read more about deleting policy](#deletion_policy) |

If you would like to run only the Fauna plugin logic, you can just add `fauna` before the command. (ex: `serverless fauna deploy`)

## Configuration

```yaml
plugins:
  - "@fauna-labs/serverless-fauna"
fauna:
  client:
    secret: ${env:FAUNA_ROOT_KEY}
    # domain: db.fauna.com
    # port: 433
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
### Collection configuration
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

### Function configuration
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

### Index configuration
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
    fields:
      -data.category
  values:
    fields:
      - path: data.type
        reverse: true
      - ref
    bindings:
      - is_current_year
```

#### Index source
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

#### Index terms

Index terms describe the fields that should be searchable.

```yaml
terms:
  fields:
    - data.search
  bindings:
    - binding
```

#### Index values
Index values describe the fields returned, and have a similar structure to `terms`, but with an additional `reverse` field to define sort order.

```yaml
values:
  fields:
    - path: data.field
      reverse: true
  bindings:
    - binding
```

#### Index binding
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

### Role configuration
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

#### Role schema privileges
Read more about the [privilege configuration object](https://docs.fauna.com/fauna/current/security/roles#pco)

For schema privileges, just specify a field key without a value:
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

If there are resources that you absolutely do not want deleted, even though they might not be in your serverless.com configuration, you can set `deletion_policy` to `retain` (the default being `destroy`) in the top level `fauna` configuration. In example below, Fauna resources will not be deleted:

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

---

Copyright Fauna, Inc. or its affiliates. All rights reserved. SPDX-License-Identifier: MIT-0

[fauna]: https://www.fauna.com/
[fauna-labs]: https://github.com/fauna-labs
[fauna-organization]: https://github.com/fauna
[serverless-framework]: https://serverless.com
[serverless-framework-example]: https://github.com/fauna-labs/serverless-fauna-example
