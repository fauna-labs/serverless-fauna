'use strict'
const Logger = require('./Logger')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    Object.assign(process.env, serverless.service.provider.environment)
    this.serverless = serverless
    this.config = this.serverless.service.initialServerlessConfig.fauna
    this.options = options
    this.logger = new Logger(serverless)
    this.defineConfigSchema()

    this.commands = {
      fauna: {
        commands: {},
      },
    }

    this.hooks = {}

    const cmdList = [require('./commands/DeployCommand')]
    cmdList.forEach((CmdCls) => this.registerCommand(CmdCls))
  }

  registerCommand(CmdCls) {
    const cmd = new CmdCls({
      serverless: this.serverless,
      config: this.config,
      options: this.options,
      logger: this.logger,
    })
    Object.assign(this.hooks, cmd.hooks)
    Object.assign(this.commands.fauna.commands, cmd.command)
  }

  defineConfigSchema() {
    const collectionProp = {
      type: 'object',
      name: { type: 'string' },
      data: { type: 'object' },
      history_days: { type: 'integer' },
      ttl_days: { type: 'integer' },
      required: ['name'],
    }

    const sourceObjProp = {
      type: 'object',
      properties: {
        collection: 'string',
      },
      required: ['collection'],
    }

    const termsProp = {
      type: 'object',
      properties: {
        fields: { type: 'array', items: { type: 'string' } },
        bindings: { type: 'array', items: { type: 'string' } },
      },
      oneOf: [{ required: 'fields' }, { required: 'bindings' }],
    }

    const valuesProp = {
      ...termsProp,
      properties: {
        ...termsProp.properties,
        reverse: { type: 'boolean' },
      },
    }

    const indexProp = {
      type: 'object',
      name: { type: 'string' },
      source: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: sourceObjProp },
          sourceObjProp,
        ],
      },
      terms: termsProp,
      values: valuesProp,
      required: ['name', 'source'],
    }

    const faunaProp = {
      type: 'object',
      properties: {
        collections: {
          type: 'object',
          patternProperties: {
            '.*': collectionProp,
          },
        },
        indexes: {
          type: 'object',
          patternProperties: {
            '.*': indexProp,
          },
        },
      },
    }

    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fauna',
      faunaProp
    )
  }
}

module.exports = ServerlessFaunaPlugin
