const { fql } = require("fauna");
const cleanup = async (client) => {
  await client.query(fql`
Collection.all().forEach(f => f.delete())
Function.all().forEach(f => f.delete())
Role.all().forEach(f => f.delete())`);
};

module.exports = { cleanup };
