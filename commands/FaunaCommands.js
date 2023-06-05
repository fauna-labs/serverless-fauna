const FQL10Commands = require("./FQL10Commands");
const FQL4DeployCommand = require("./FQL4DeployCommand");
const FQL4RemoveCommand = require("./FQL4RemoveCommand");

class FaunaCommands {
  /**
   *  Takes an ordered list of deploy and remove commands and constructs
   *  a FaunaCommands instance.
   *
   * @param config the top level config provided by serverless
   * @param deployCommands An ordered list of deploy commands.
   * @param removeCommands An ordered list of remove commands.
   * @param options Options
   */
  constructor({ config, deployCommands, removeCommands, options }) {
    this.config = config;
    this.deployCommands = deployCommands;
    this.removeCommands = removeCommands;
    this.options = { ...options };

    this.command = {
      deploy: {
        usage:
          "Deploy all schema definitions. FQL 10 resources are deployed first.",
        lifecycleEvents: ["deploy"],
        options: {
          "schema-version": {
            usage:
              'Specify the schema to deploy. Valid values are "4" and "10". If unspecified, all schemas will be deployed. (e.g. "--schema-version 10"',
            type: "string",
          },
        },
      },
      remove: {
        usage:
          "Remove all schema managed by this plugin. FQL 10 resources are removed last.",
        lifecycleEvents: ["remove"],
        options: {
          "schema-version": {
            usage:
              'Specify the schema version to remove. Valid values are "4" and "10". If unspecified, all schemas will be removed. (e.g. "--schema-version 10"',
            type: "string",
          },
        },
      },
    };
    this.hooks = {
      "deploy:deploy": this.deploy.bind(this),
      "fauna:deploy:deploy": this.deploy.bind(this),

      "remove:remove": this.remove.bind(this),
      "fauna:remove:remove": this.remove.bind(this),
    };
  }

  async deploy() {
    if (this.options["schema-version"] == null) {
      {
        for (const cmd of this.deployCommands) {
          await cmd.deploy();
        }
      }
    } else if (this.options["schema-version"] === "10") {
      if (this.config.fauna_v10 == null) {
        throw new Error("No `fauna_v10` (FQL 10) schema defined.");
      }

      for (const cmd of this.deployCommands) {
        if (cmd instanceof FQL10Commands) {
          await cmd.deploy();
        }
      }
    } else if (this.options["schema-version"] === "4") {
      if (this.config.fauna == null) {
        throw new Error("No `fauna` (FQL 4) schema defined.");
      }

      for (const cmd of this.deployCommands) {
        if (cmd instanceof FQL4DeployCommand) {
          await cmd.deploy();
        }
      }
    } else {
      throw new Error(`Unsupported schema option: ${this.options.schema}`);
    }
  }

  async remove() {
    if (this.options["schema-version"] == null) {
      {
        for (const cmd of this.removeCommands) {
          await cmd.remove();
        }
      }
    } else if (this.options["schema-version"] === "10") {
      if (this.config.fauna_v10 == null) {
        throw new Error("No `fauna10` (FQL 10) schema defined.");
      }

      for (const cmd of this.removeCommands) {
        if (cmd instanceof FQL10Commands) {
          await cmd.remove();
        }
      }
    } else if (this.options["schema-version"] === "4") {
      if (this.config.fauna == null) {
        throw new Error("No `fauna` (FQL 4) schema defined.");
      }

      for (const cmd of this.removeCommands) {
        if (cmd instanceof FQL4RemoveCommand) {
          await cmd.remove();
        }
      }
    } else {
      throw new Error(`Unsupported schema option: ${this.options.schema}`);
    }
  }
}

module.exports = FaunaCommands;
