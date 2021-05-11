'use strict'
const Logger = require('./Logger')
const DeployCommand = require('./commands/DeployCommand')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
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

    const cmdList = [DeployCommand]
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
        active: { type: 'boolean' },
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
        role: { type: 'string' },
      },
      required: ['name', 'body'],
      additionalProperties: false,
    }

    const clientProp = {
      type: 'object',
      properties: {
        secret: { type: 'string' },
        domain: { type: 'string' },
        scheme: { type: 'string' },
        port: { type: 'number' },
      },
      additionalProperties: false,
      required: ['secret'],
    }

    const rolePrivilegeSchemaActionsProp = {
      type: 'object',
      additionalProperties: false,
      properties: {
        read: { type: 'boolean' },
        write: { type: 'boolean' },
        create: { type: 'boolean' },
        delete: { type: 'boolean' },
        history_read: { type: 'boolean' },
        history_write: { type: 'boolean' },
      },
    }

    const rolePrivilegeCollectionActionsProp = {
      type: 'object',
      additionalProperties: false,
      properties: {
        read: { anyOf: [{ type: 'boolean' }, { type: 'string' }] },
        write: { anyOf: [{ type: 'boolean' }, { type: 'string' }] },
        create: { type: 'boolean' },
        delete: { type: 'boolean' },
        history_read: { type: 'boolean' },
        history_write: { type: 'boolean' },
        unrestricted_read: { type: 'boolean' },
      },
    }

    const rolePrivilegeFunctionActionsProp = {
      type: 'object',
      additionalProperties: false,
      properties: {
        call: { type: 'boolean' },
      },
    }

    const rolePrivilegeIndexActionsProp = {
      type: 'object',
      additionalProperties: false,
      properties: {
        unrestricted_read: { type: 'boolean' },
        read: { type: 'boolean' },
      },
    }

    const rolePrivilegeProp = {
      type: 'object',
      additionalProperties: false,
      properties: {
        collection: { type: 'string' },
        index: { type: 'string' },
        function: { type: 'string' },
        // following fields has type `boolean` as a workaround that allow use format like:
        // indexes:
        indexes: { type: 'boolean' },
        collections: { type: 'boolean' },
        databases: { type: 'boolean' },
        roles: { type: 'boolean' },
        functions: { type: 'boolean' },
        keys: { type: 'boolean' },
        actions: {
          anyOf: [
            rolePrivilegeSchemaActionsProp,
            rolePrivilegeCollectionActionsProp,
            rolePrivilegeFunctionActionsProp,
            rolePrivilegeIndexActionsProp,
          ],
        },
      },
    }

    const membershipProp = {
      type: 'object',
      required: ['resource'],
      additionalProperties: false,
      properties: {
        resource: { type: 'string' },
        predicate: { type: 'string' },
      },
    }

    const roleProp = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        membership: {
          anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
            membershipProp,
            { type: 'array', items: membershipProp },
          ],
        },
        privileges: {
          type: 'array',
          items: rolePrivilegeProp,
        },
      },
      additionalProperties: false,
      required: ['name', 'privileges'],
    }

    const faunaProp = {
      type: 'object',
      properties: {
        client: clientProp,
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
        roles: {
          type: 'object',
          patternProperties: {
            '.*': roleProp,
          },
        },
      },
      required: ['client'],
      additionalProperties: false,
    }

    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fauna',
      faunaProp
    )
  }
}

module.exports = ServerlessFaunaPlugin
