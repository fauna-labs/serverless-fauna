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
      properties: {
        name: { type: 'string' },
        data: { type: 'object' },
        history_days: { type: 'integer' },
        ttl_days: { type: 'integer' },
      },
      required: ['name'],
      additionalProperties: false,
    }

    const sourceObjProp = {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        fields: {
          type: 'object',
          patternProperties: {
            '.*': { type: 'string' },
          },
        },
      },
      required: ['collection'],
      additionalProperties: false,
    }

    const termsProp = {
      type: 'object',
      properties: {
        fields: { type: 'array', items: { type: 'string' } },
        bindings: { type: 'array', items: { type: 'string' } },
      },
      oneOf: [{ required: ['fields'] }, { required: ['bindings'] }],
      additionalProperties: false,
    }

    const valueFieldProp = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        reverse: { type: 'boolean' },
      },
      required: ['path'],
      additionalProperties: false,
    }

    const valuesProp = {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            oneOf: [{ type: 'string' }, valueFieldProp],
          },
        },
        bindings: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    }

    const indexProp = {
      type: 'object',
      properties: {
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
        data: { type: 'object' },
      },
      required: ['name', 'source'],
      additionalProperties: false,
    }

    const functionProp = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        body: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['name', 'body'],
      additionalProperties: false,
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
        functions: {
          type: 'object',
          patternProperties: {
            '.*': functionProp,
          },
        },
      },
      additionalProperties: false,
    }

    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fauna',
      faunaProp
    )
  }
}

module.exports = ServerlessFaunaPlugin
