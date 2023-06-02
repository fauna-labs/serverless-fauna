"use strict";
const Logger = require("./Logger");
const FQL4DeployCommand = require("./commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("./commands/FQL4RemoveCommand");
const faunaSchemaProperties = require("./schemaProps/fauna");
const getClient = require("./fauna/client");

const fqlxSchemaProperties = require("./fqlx/schema/fql10");
const getFQLXClient = require("./fqlx/client");
const FQLXCommands = require("./commands/FQLXCommands");
const FaunaCommands = require("./commands/FaunaCommands");

class ServerlessFaunaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.config = this.serverless.service.initialServerlessConfig;
    this.options = options;
    this.logger = new Logger(serverless.cli);
    this.hooks = {};

    this.commands = {
      fauna: {
        commands: {},
        options: {},
      },
    };

    this.initSchema();

    const deployCommands = [];
    const removeCommands = [];

    if (this.config.fql10 !== undefined) {
      // sls --help doesn't resolve yaml ${} vars, so we can't construct a client
      const client = options.help
        ? null
        : getFQLXClient(this.config.fql10.client);
      const cmd = new FQLXCommands({
        faunaClient: client,
        serverless: this.serverless,
        config: this.config.fql10,
        options: this.options,
        logger: this.logger,
      });

      deployCommands.push(cmd);
      removeCommands.push(cmd);
    }

    if (this.config.fauna !== undefined) {
      // sls --help doesn't resolve yaml ${} vars, so we can't construct a client
      const client = options.help ? null : getClient(this.config.fauna.client);
      const deploy = new FQL4DeployCommand({
        faunaClient: client,
        serverless: this.serverless,
        config: this.config.fauna,
        options: this.options,
        logger: this.logger,
      });

      deployCommands.push(deploy);

      const remove = new FQL4RemoveCommand({
        faunaClient: client,
        serverless: this.serverless,
        config: this.config.fauna,
        options: this.options,
        logger: this.logger,
      });

      removeCommands.push(remove);
    }

    const faunaCommands = new FaunaCommands(
      this.config,
      deployCommands,
      removeCommands.reverse()
    );

    Object.assign(this.hooks, faunaCommands.hooks);
    Object.assign(this.commands.fauna.commands, faunaCommands.command);
  }

  initSchema() {
    this.serverless.configSchemaHandler.defineTopLevelProperty(
      "fql10",
      fqlxSchemaProperties
    );

    this.serverless.configSchemaHandler.defineTopLevelProperty(
      "fauna",
      faunaSchemaProperties
    );
  }
}

module.exports = ServerlessFaunaPlugin;
