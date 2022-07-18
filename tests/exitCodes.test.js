const { promisify } = require('util');
const spawn = require('child_process').spawn;
const exec = promisify(require('child_process').exec);
const assert = require('assert');
const faunadb = require('faunadb');
const q = faunadb.query;

// This test requires a local fauna container to be running.
jest.setTimeout(30000);
describe('deploy exit codes', () => {
  beforeAll(async () => {
    await start_db();
  });
  afterAll(async () => {
    // await stop_db();
  });
  const client = get_client();
  test('exit code 1', async () => {
    await assert.rejects(async () => await exec("sls deploy -c fail-invalid-secret.yml", { "cwd": `${__dirname}/config` }));
    await assert_empty(client);
  });
  test('exit code 1', async () => {
    await assert.rejects(async () => await exec("sls deploy -c fail-invalid-collection.yml", { "cwd": `${__dirname}/config` }));
    // TODO: The database will be split here, so it won't actually be empty.
    // await assert_empty(client);
  });
  test('exit code 0', async () => {
    await exec("sls deploy -c valid.yml", { "cwd": `${__dirname}/config` });
    // TODO: Make sure the db has a collection here
    await assert_empty(client);
  });
});

function get_client() {
  return new faunadb.Client({ secret: "secret", port: 9001, domain: "localhost", scheme: "http" });
}

async function assert_empty(client) {
  let result = await client.query(q.Paginate(q.Collections()));
  console.log(result);
  expect(result.data).toEqual([]);
}

async function start_db(docker) {
  console.log("Starting local FaunaDB instance...");
  // This is much clearer than using the nodejs docker api, and much simpler.
  let child = spawn("docker", ["run", "--rm", "--name", "faunadb-sls-test", "-p", "9001:8443", "fauna/faunadb"]);
  let read_number = 0;
  await new Promise((resolve, reject) => {
    child.stdout.on("data", function(data) {
      if (data.toString().trim() == "FaunaDB is ready.") {
        read_number += 1;
      }
      if (read_number == 2) {
        resolve();
      }
    });
    child.on('close', resolve);
  });
  console.log("FaunaDB has started!");
}

async function stop_db(docker) {
  console.log("Stopping local FaunaDB instance...");
  let child = spawn("docker", ["stop", "faunadb-sls-test"]);
  await new Promise((resolve, reject) => {
    child.on('close', resolve);
  });
  console.log("Stopped FaunaDB");
}
