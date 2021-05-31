'use strict'
const Logger = require('./Logger')
const DeployCommand = require('./commands/DeployCommand')
const RemoveCommand = require('./commands/RemoveCommand')
const faunaSchemaProperties = require('./schemaProps/fauna')
const getClient = require('./fauna/client')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.config = this.serverless.service.initialServerlessConfig.fauna
    this.options = options
    this.logger = new Logger(serverless.cli)
    this.faunaClient = getClient(this.config.client)
    this.serverless.configSchemaHandler.defineTopLevelProperty(
      'fauna',
      faunaSchemaProperties
    )
    this.commands = {
      fauna: {
        commands: {},
      },
    }

    this.hooks = {}

    const cmdList = [DeployCommand, RemoveCommand]
    cmdList.forEach((CmdCls) => this.registerCommand(CmdCls))
  }

  registerCommand(CmdCls) {
    const cmd = new CmdCls({
      faunaClient: this.faunaClient,
      serverless: this.serverless,
      config: this.config,
      options: this.options,
      logger: this.logger,
    })
    Object.assign(this.hooks, cmd.hooks)
    Object.assign(this.commands.fauna.commands, cmd.command)
  }
}

module.exports = ServerlessFaunaPlugin
