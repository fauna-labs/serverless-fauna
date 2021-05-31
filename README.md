# Serverless Fauna

A serverless plugin to easily describe Fauna infrastructure as a code. Plugins helps to keep Fauna up to serverless configuration and will create/update resources such as collections/indexes

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
$ npm install serverless-fauna --save-dev
```
or using yarn
```bash
$ yarn add serverless-fauna
```

## Commands 
The plugin listens hooks from default serverless command and run his own logic

| command    | description                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| sls deploy | sync Fauna resources specified a config. All resources created by the plugin has boolean property `created_by_serverless_plugin` set to `true` |
| sls remove | sync Fauna resources created by plugin [read more about deleting policy](#deleting_policy)                                                     |

If you would like to run only the Fauna plugin logic, you can just add `fauna` before the command. (ex: `sls fauna deploy`)

## Configuration

```yaml
plugins:
  - serverless-fauna
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
      body: ${file('./double.fql')}

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
Can accept any param that accept `CreateCollection` query.
Read more about params [here](https://docs.fauna.com/fauna/current/api/fql/functions/createcollection?lang=javascript#param_object)

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
Can accept any param that accept `CreateFunction` query.
Read more about params [here](https://docs.fauna.com/fauna/current/api/fql/functions/createfunction?lang=javascript)

```yaml
  functions:
    double:
      name: double
      body: ${file('./double.fql')}
      role: admin
      data:
        desc: double number

```

### Index configuration
Can accept any param that accept CreateIndex query.
Read more about params [here](https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object)

`terms`, `values` and `source` can be set only if index doesn't exists. If you change those configuration for existing index, plugin would throw an error when tried update it

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
Index source could be a string and interpreted as collection reference

```yaml
source: Movie
```

Or a source object. Read more about [source object](https://docs.fauna.com/fauna/current/api/fql/indexes?lang=javascript#source)

```yaml
source:
  collection: Movie
```

Or an array of object

```yaml
source:
  - collection: Movies
  - collection: Cartoons
  - collection: Series
```

#### Index terms

```yaml
terms:
  fields:
    - data.search
  bindings:
    - binding
```

#### Index values
Index values looks pretty the same as terms, but has additional `reverse` field which determinate sort order

```yaml
values:
  fields:
    - path: data.field
      reverse: true
  bindings:
    - binding
```

#### Index binding
Index allow you to compute fields for a source while the document is being indexed.
Read more about [index bindings](https://docs.fauna.com/fauna/current/tutorials/indexes/bindings)
You can specify multiline fql

```yml
source:
  collection: Movies
  fields:
    is_current_year: >
      Equals([
        Year(Now()),
        ToInteger(Select(['data', 'release_year'], Var('doc')))
      ])
```
Or create file with `.fql` extension. We have [Fauna VSCode plugin](https://marketplace.visualstudio.com/items?itemName=fauna.fauna) to handle `.fql` files

```yml
source:
  collection: Movies
  fields:
    is_current_year: ${file(./IsCurrentYear.fql)}
```

### Role configuration
Can accept any param that accept CreateRole query.
Read more about params [here](https://docs.fauna.com/fauna/current/api/fql/functions/createrole?lang=javascript)

```yml
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
Read more about [privilege configuration object](https://docs.fauna.com/fauna/current/security/roles#pco)

For schema privileges just specify field key without value
```yml
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

You can also pass action predicate

```yml
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

```yml
roles:
  actor:
    name: actor
    membership: actor
```

Or as an array
```yml
roles:
  actor:
    name: participant
    membership: 
      - actor
      - directors
```

You can also pass [membership object](https://docs.fauna.com/fauna/current/security/roles#mco)

```yml
roles:
  only_active:
    name: only_active
    membership:
      resource: ${self:fauna.collections.users.name}
      predicate: ${file(./IsActiveUser.fql)}
```
Or an array of membership objects
```yml
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
Plugin keeps sync between serverless configuration and the current Fauna state. Therefore, the plugin will remove all resources that currently exist at the Fauna but not declared at configuration would be removed. However, there are some resources that you absolutely do not want get deleted.
You can set `deletion_policy` to `retain`. (default `destroy`) to the top level `fauna` configuration
In example below, Fauna resources would not be deleted

```yaml
fauna: 
  deleting_policy: retain
```

In spite of property `deleting_policy` specified at the top level, resource level property has a higher priority. Therefore, with the following configuration collection `logs` would be removed and the rest of resources will be saved

```yaml
fauna:
  deleting_policy: retain
collections:
  Movies: 
    name: Movies
  logs:
    name: logs
    deleting_policy: destroy
```