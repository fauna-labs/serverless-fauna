const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const assert = require('assert');

// This test requires a local fauna container to be running.
describe('deploy exit codes', () => {
  jest.setTimeout(30000);
  // TODO: Start db here
  // TODO: Make sure the db is empty here
  test('exit code 1', async () => {
    await assert.rejects(async () => await exec("sls deploy -c fail-invalid-secret.yml", { "cwd": `${__dirname}/config` }));
  });
  // TODO: Make sure the db is empty here
  test('exit code 1', async () => {
    await assert.rejects(async () => await exec("sls deploy -c fail-invalid-collection.yml", { "cwd": `${__dirname}/config` }));
  });
  // TODO: Make sure the db is empty here
  test('exit code 0', async () => {
    await exec("sls deploy -c valid.yml", { "cwd": `${__dirname}/config` });
  });
  // TODO: Make sure the db has a collection here
});
