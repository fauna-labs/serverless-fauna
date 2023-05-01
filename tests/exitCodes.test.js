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
    await stop_db();
  });
  const client = get_client();
  test('exit code 1', async () => {
    await exec_sls_fail("fail-invalid-secret.yml");
    await assert_empty(client);
  });
  test('exit code 1', async () => {
    await exec_sls_fail("fail-invalid-collection.yml");
    // TODO: The database will be split here, so it won't actually be empty.
    // This check should be enabled once the split database has been fixed.
    // await assert_empty(client);
    await clear_database(client);
  });
  test('exit code 0', async () => {
    await exec_sls_work("valid.yml");
    await assert_matches(client, {
      collections: [ "movies_2" ],
      indexes: [ "movies_ts_2" ],
    });
  });
});

function get_client() {
  return new faunadb.Client({ secret: "secret", port: 9001, domain: "localhost", scheme: "http" });
}

async function assert_empty(client) {
  await assert_matches(client, {
    collections: [],
    indexes: [],
  });
}
async function assert_matches(client, expected) {
  let result = await client.query({
    collections: q.Select("data", q.Map(
      q.Paginate(q.Collections()),
      q.Lambda("x", q.Select("name", q.Get(q.Var("x"))))
    )),
    indexes: q.Select("data", q.Map(
      q.Paginate(q.Indexes()),
      q.Lambda("x", q.Select("name", q.Get(q.Var("x"))))
    )),
  });
  assert.deepEqual(result, expected);
}
async function clear_database(client) {
  // Deleting collections will also delete all indexes.
  await client.query(q.Map(
    q.Paginate(q.Collections()),
    q.Lambda("x", q.Delete(q.Var("x"))),
  ));
}

async function exec_sls_fail(config) {
  let child = spawn("sls", ["deploy", "-c", config], { "cwd": `${__dirname}/config` });

  await new Promise((resolve, reject) => {
    child.stdout.on("data", function(data) {
      console.log(data.toString());
    });
    child.on('close', (code) => {
      if (code == 1) {
        resolve();
      } else {
        reject(`expected exit 1, got: ${code}`);
      }
    });
  });
}
async function exec_sls_work(config) {
  let child = spawn("sls", ["deploy", "-c", config], { "cwd": `${__dirname}/config` });

  await new Promise((resolve, reject) => {
    child.stdout.on("data", function(data) {
      console.log(data.toString());
    });
    child.on('close', (code) => {
      if (code == 0) {
        resolve();
      } else {
        reject(`expected exit 0, got: ${code}`);
      }
    });
  });
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
