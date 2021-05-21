'use strict'
const Logger = require('./Logger')
const DeployCommand = require('./commands/DeployCommand')
const faunaSchemaProperties = require('./schemaProps/fauna')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.config = this.serverless.service.initialServerlessConfig.fauna
    this.options = options
    this.logger = new Logger(serverless)
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
}

module.exports = ServerlessFaunaPlugin
