"use strict";
const Logger = require("./Logger");
const FQL4DeployCommand = require("./commands/FQL4DeployCommand");
const FQL4RemoveCommand = require("./commands/FQL4RemoveCommand");
const faunaV4Schema = require("./fauna/v4/schema/fauna");
const getV4Client = require("./fauna/v4/client");

const faunaV10Schema = require("./fauna/v10/schema/fauna");
const getV10Client = require("./fauna/v10/client");
const FQL10Commands = require("./commands/FQL10Commands");
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

    // If --help is true, init with nothing and return
    if (options.help) {
      const cmd = new FaunaCommands({
        deployCommand: null,
        removeCommand: null,
      });
      Object.assign(this.hooks, cmd.hooks);
      Object.assign(this.commands.fauna.commands, cmd.command);
      return;
    }

    this.config.fauna.version = this.config.fauna.version ?? "4";

    if (
      this.config.fauna.version === "10" ||
      this.config.fauna.version === 10
    ) {
      this.serverless.configSchemaHandler.defineTopLevelProperty(
        "fauna",
        faunaV10Schema
      );

      const v10cmd = new FQL10Commands({
        faunaClient: getV10Client(this.config.fauna.client),
        serverless: this.serverless,
        config: this.config.fauna,
        options: this.options,
        logger: this.logger,
      });

      const cmd = new FaunaCommands({
        config: this.config,
        deployCommand: v10cmd,
        removeCommand: v10cmd,
      });

      Object.assign(this.hooks, cmd.hooks);
      Object.assign(this.commands.fauna.commands, cmd.command);
    } else if (
      this.config.fauna.version === "4" ||
      this.config.fauna.version === 4
    ) {
      this.serverless.configSchemaHandler.defineTopLevelProperty(
        "fauna",
        faunaV4Schema
      );

      const client = getV4Client(this.config.fauna.client);
      const v4deploy = new FQL4DeployCommand({
        faunaClient: client,
        serverless: this.serverless,
        config: this.config.fauna,
        options: this.options,
        logger: this.logger,
      });

      const v4remove = new FQL4RemoveCommand({
        faunaClient: client,
        serverless: this.serverless,
        config: this.config.fauna,
        options: this.options,
        logger: this.logger,
      });

      const cmd = new FaunaCommands({
        config: this.config,
        deployCommand: v4deploy,
        removeCommand: v4remove,
      });

      Object.assign(this.hooks, cmd.hooks);
      Object.assign(this.commands.fauna.commands, cmd.command);
    } else {
      throw new Error(
        `Version must be '4' or '10', but was '${this.config.fauna.version}'`
      );
    }
  }
}

module.exports = ServerlessFaunaPlugin;
