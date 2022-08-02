const RemoveQuery = require("../fauna/RemoveQuery");

class RemoveCommand {
  command = {
    remove: {
      usage:
        "remove fauna schema. the same logic executed for `sls remove` command",
      lifecycleEvents: ["remove"],
    },
  };

  hooks = {
    "remove:remove": this.remove.bind(this),
    "fauna:remove:remove": this.remove.bind(this),
  };

  constructor({ faunaClient, logger }) {
    this.faunaClient = faunaClient;
    this.logger = logger;
  }

  remove() {
    return this.faunaClient
      .query(RemoveQuery())
      .then((resources) => {
        if (resources.length) {
          resources.map((res) =>
            this.logger.success(`Resource ${res} deleted`)
          );
        } else {
          this.logger.success(
            "Nothing to delete. If you still have some resources left, check `data.deletion_policy` of resources"
          );
        }
      })
      .catch((error) => {
        console.info(error);
        this.logger.error(error);
      });
  }
}

module.exports = RemoveCommand;
