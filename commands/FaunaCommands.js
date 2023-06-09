class FaunaCommands {
  /**
   *  Takes a deploy and remove command and hooks them into serverless deploy and remove.
   *
   * @param deployCommand A deploy command.
   * @param removeCommand A remove command.
   */
  constructor({deployCommand, removeCommand}) {
    this.deployCommand = deployCommand;
    this.removeCommand = removeCommand;

    this.command = {
      deploy: {
        usage:
          "Deploy the fauna schema definition.",
        lifecycleEvents: ["deploy"],
      },
      remove: {
        usage:
          "Remove all schema managed by this plugin.",
        lifecycleEvents: ["remove"],
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
    await this.deployCommand.deploy();
  }

  async remove() {
    await this.removeCommand.remove();
  }
}

module.exports = FaunaCommands;
