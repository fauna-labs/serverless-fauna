const { fql } = require("fauna");
const cleanup = async (client) => {
  await client.query(fql`
Collection.all().toArray().forEach(f => f.delete())
Function.all().toArray().forEach(f => f.delete())
Role.all().toArray().forEach(f => f.delete())`);
};

module.exports = { cleanup };
