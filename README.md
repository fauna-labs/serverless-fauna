# Serverless Fauna

A serverless plugin to easily describe Fauna infrastructure as a code. Plugins helps to keep Fauna up to serverless configuration and will create/update resources such as collections/indexes

## TODO list
- CreateIndex binding. read fql from configuration or file
- Support reverse index
- delete resource (consider `deletion_policy` of the resource)
- create/update/delete UDF

## Usage

### Installation

```bash
$ npm install serverless-fauna --save-dev
```
or using yarn
```bash
$ yarn add serverless-fauna
```

### Configuration

```yaml
plugins:
  - serverless-fauna
fauna:
    collections:
      Movies: 
        name: Movies
        data:
          some_data_key: some_data_value

    indexes:
      movies_by_type:
        name: movies_by_type
        source: ${self:fauna.collections.Movies.name}
        terms:
          field: 
            - data.type

      movies_by_category:
        name: movies_by_category
        source: ${self:fauna.collections.Movies.name}
        data:
          some_data_key: some_data_value
        terms:
          field: 
            - data.category

      sort_by_year:
        name: sort_by_year
        source: ${self:fauna.collections.Movies.name}
        values:
          field:
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

### Index configuration
Can accept any param that accept CreateIndex query.
Read more about params [here](https://docs.fauna.com/fauna/current/api/fql/functions/createindex?lang=javascript#param_object)

```yaml
search_by_category_and_sort_by_year:
  name: search_by_category_and_sort_by_year
  source: 
    collection: ${self:fauna.collections.Movies.name}
    binding: TODO: FQL HERE
  terms:
    field:
      -data.category
  values:
    field:
      - path: data.type
        reverse: true
      - ref
    binding:
      - TODO:
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
  field:
    - data.search
  binding:
    - binding
```

#### Index values
Index values looks pretty the same as terms, but has additional `reverse` field which determinate sort order
```yaml
values:
  field:
    - path: data.field
      reverse: true
  binding:
    - binding
```

#### Index binding
Index allow you to compute fields for a source while the document is being indexed.
Read more about [index bindings](https://docs.fauna.com/fauna/current/tutorials/indexes/bindings)
TODO: test and specify format



### Deletion policy
Plugin keep sync between serverless configuration and current Fauna state. Therefore, plugin will remove all resources that currently exists at the Fauna but not declared at configuration would be removed. However, there are some resources that you absolutely do not want getting deleted.
You can set `deletion_policy` of `data` field to `retain`. If entity has this deletion policy, plugin would not delete it.

```yaml
collections:
  Movies: 
    name: Movies
    data: 
      deletion_policy: retain
```
