const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const assert = require('assert');

// This test requires a local fauna container to be running.
describe('deploy exit codes', () => {
  jest.setTimeout(30000);
  test('exit code 1', async () => {
    await assert.rejects(async () => await exec("sls deploy -c failure.yml"), { "cwd": "./tests/config" });
  });
  test('exit code 0', async () => {
    await exec("sls deploy -c valid.yml", { "cwd": "./tests/config" });
  });
});
