const { mergeDefaultMetadata, objToArray } = require("./objects");
const { fql } = require("fauna");

const verifyLogs = (mockedLog, logs) => {
  expect(mockedLog.mock.calls.map((c) => c[0])).toEqual(logs);
  mockedLog.mockClear();
};

const verifyFunctions = async (client, functions = {}) => {
  functions = objToArray(functions)
    .map(mergeDefaultMetadata)
    .sort((a, b) => (a.name > b.name ? 1 : -1));

  const actual = await client.query(fql`Function.all().order( .name )`);
  if (functions.length !== actual.data.data.length) {
    expect(actual.data.data).toEqual(functions);
  }

  for (let i = 0; i < functions.length; i++) {
    const e = functions[i];
    const a = actual.data.data[i];

    expect(a.data).toEqual(e.data);
    expect(a.name).toEqual(e.name);
    expect(a.body).toEqual(e.body);
    expect(a.role).toEqual(e.role);
  }
};

const verifyCollections = async (client, collections = {}) => {
  collections = objToArray(collections)
    .map(mergeDefaultMetadata)
    .sort((a, b) => (a.name > b.name ? 1 : -1));

  const actual = await client.query(
    fql`Collection.all().order( .name ).toArray()`
  );
  if (collections.length !== actual.data.length) {
    expect(actual.data).toEqual(collections);
  }

  for (let i = 0; i < collections.length; i++) {
    const e = collections[i];
    const a = actual.data[i];
    Object.keys(a.indexes).forEach((k) => {
      // Remove status because it's not managed by the user
      delete a.indexes[k].status;
    });

    a.constraints.forEach((c) => {
      // Remove status because it's not managed by the user
      delete c.status;
    });

    expect(a.data).toEqual(e.data);
    expect(a.indexes).toEqual(e.indexes ?? {});
    expect(a.constraints).toEqual(e.constraints ?? []);
  }
};

module.exports = { verifyCollections, verifyFunctions, verifyLogs };
