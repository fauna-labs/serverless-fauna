'use strict'
const Logger = require('./Logger')
const DeployCommand = require('./commands/DeployCommand')
const RemoveCommand = require('./commands/RemoveCommand')
const faunaSchemaProperties = require('./schemaProps/fauna')
const getClient = require('./fauna/client')

const fqlxSchemaProperties = require('./fqlx/schema/fauna')
const getFQLXClient = require('./fqlx/client')
const FQLXCommands = require('./commands/FQLXCommands')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.config = this.serverless.service.initialServerlessConfig
    this.options = options
    this.logger = new Logger(serverless.cli)
    this.hooks = {}

    this.commands = {
      fauna: {
        commands: {},
        options: {},
      },
      fqlx: {
        commands: {},
        options: {}
      }
    }

    this.initV10()
    this.initV4()
  }

  initV10() {
    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fqlx',
      fqlxSchemaProperties
    )

    const client = this.config.fqlx !== undefined ? getFQLXClient(this.config.fqlx.client) : null
    const cmdList = [FQLXCommands]
    cmdList.forEach((CmdCls) => this.registerCommand(CmdCls, client, "fqlx"))
  }

  initV4() {
    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fauna',
      faunaSchemaProperties
    )

    const cmdList = [DeployCommand, RemoveCommand]
    const client = this.config.fauna !== undefined ? getClient(this.config.fauna.client) : null
    cmdList.forEach((CmdCls) => this.registerCommand(CmdCls, client, "fauna"))
  }

  registerCommand(CmdCls, client, namespace) {
    const cmd = new CmdCls({
      faunaClient: client,
      serverless: this.serverless,
      config: this.config[namespace],
      options: this.options,
      logger: this.logger,
    })
    Object.assign(this.hooks, cmd.hooks)
    Object.assign(this.commands[namespace].commands, cmd.command)
  }
}

module.exports = ServerlessFaunaPlugin
