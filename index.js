'use strict'
const Logger = require('./Logger')

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    Object.assign(process.env, serverless.service.provider.environment)
    this.serverless = serverless
    this.options = options

    this.logger = new Logger(serverless)

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
      options: this.options,
      logger: this.logger,
    })
    Object.assign(this.hooks, cmd.hooks)
    Object.assign(this.commands.fauna.commands, cmd.command)
  }
}

module.exports = ServerlessFaunaPlugin
