const RemoveQuery = require("../fauna/v4/RemoveQuery");

class FQL4RemoveCommand {
  constructor({ faunaClient, logger }) {
    this.faunaClient = faunaClient;
    this.logger = logger;
  }

  async remove() {
    return await this.faunaClient
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
        this.logger.error(error);

        // Rethrow so we non-zero exit
        throw error;
      });
  }
}

module.exports = FQL4RemoveCommand;
