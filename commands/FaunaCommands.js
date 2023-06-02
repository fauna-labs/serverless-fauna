const FQLXCommands = require("./FQLXCommands");
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
   */
  constructor(config, deployCommands, removeCommands) {
    this.config = config;
    this.deployCommands = deployCommands;
    this.removeCommands = removeCommands;

    this.command = {
      deploy: {
        usage:
          "Deploy all schema definitions. FQL 10 resources are deployed first.",
        lifecycleEvents: ["deploy"],
      },
      remove: {
        usage:
          "Remove all schema managed by this plugin. FQL 10 resources are removed last.",
        lifecycleEvents: ["remove"],
      },
      fql10: {
        commands: {
          deploy: {
            usage: "Deploy only FQL 10 schema definitions. (beta)",
            lifecycleEvents: ["deploy"],
            options: {
              dryrun: {
                usage: "Specify a dryrun",
                required: false,
                default: false,
                type: "boolean",
              },
            },
          },
          remove: {
            usage: "Remove only FQL 10 schema managed by this plugin. (beta)",
            lifecycleEvents: ["remove"],
            options: {
              dryrun: {
                usage: "Specify a dryrun",
                required: false,
                default: false,
                type: "boolean",
              },
            },
          },
        },
      },
      fql4: {
        commands: {
          deploy: {
            usage: "Deploy only FQL 4 schema definitions.",
            lifecycleEvents: ["deploy"],
          },
          remove: {
            usage: "Remove only FQL 4 schema managed by this plugin.",
            lifecycleEvents: ["remove"],
          },
        },
      },
    };

    this.hooks = {
      "deploy:deploy": this.deploy.bind(this),
      "fauna:deploy:deploy": this.deploy.bind(this),
      "fauna:fql10:deploy:deploy": this.deployFql10.bind(this),
      "fauna:fql4:deploy:deploy": this.deployFql4.bind(this),

      "remove:remove": this.remove.bind(this),
      "fauna:remove:remove": this.remove.bind(this),
      "fauna:fql10:remove:remove": this.removeFql10.bind(this),
      "fauna:fql4:remove:remove": this.removeFql4.bind(this),
    };
  }

  async deploy() {
    for (const cmd of this.deployCommands) {
      await cmd.deploy();
    }
  }

  async remove() {
    for (const cmd of this.removeCommands) {
      await cmd.remove();
    }
  }

  async deployFql10() {
    if (this.config.fql10 == null) {
      throw new Error("No `fql10` schema defined.");
    }

    for (const cmd of this.deployCommands) {
      if (cmd instanceof FQLXCommands) {
        await cmd.deploy();
      }
    }
  }

  async removeFql10() {
    if (this.config.fql10 == null) {
      throw new Error("No `fql10` schema defined.");
    }

    for (const cmd of this.removeCommands) {
      if (cmd instanceof FQLXCommands) {
        await cmd.remove();
      }
    }
  }

  async deployFql4() {
    if (this.config.fauna == null) {
      throw new Error("No `fauna` (FQL 4) schema defined.");
    }

    for (const cmd of this.deployCommands) {
      if (cmd instanceof FQL4DeployCommand) {
        await cmd.deploy();
      }
    }
  }

  async removeFql4() {
    if (this.config.fauna == null) {
      throw new Error("No `fauna` (FQL 4) schema defined.");
    }

    for (const cmd of this.removeCommands) {
      if (cmd instanceof FQL4RemoveCommand) {
        await cmd.remove();
      }
    }
  }
}

module.exports = FaunaCommands;
