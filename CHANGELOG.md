# Changelog

## [0.3.0] - 2023-05-12

### Added

- Support for FQL X schema (only Functions)
- New top-level property `fqlx` for declaring FQL X schema
- New `serverless fauna fqlx deploy` command to sync only FQL X schema
- New `serverless fauna fqlx remove` command to remove only FQL X schema managed by the plugin
- New `serverless fauna fql4 deploy` command to sync only FQL 4 schema (declared under `fauna` property)
- New `serverless fauna fql4 remove` command to remove only FQL 4 schema managed by the plugin

### Changed

- Update `serverless fauna deploy` command to sync both FQL X and FQL 4 schema declared in the same file
- Update `serverless fauna remove` command to remove both FQL X and FQL 4 schema managed by the plugin
- All commands will now exist non-zero when an error occurs. This should improve behavior in CI/CD

## [0.2.0]

Update to serverless 3. This has some significant breaking changes, including that you
can no longer have `serverless.yml` in a nested directory. Here is a list of all the breaking
changes in serverless 3: https://www.serverless.com/framework/docs/guides/upgrading-v3
