const { mergeDefaultMetadata, objToArray } = require("./objects");
const { fql } = require("fauna");

const verifyLogs = (mockedLog, logs) => {
  expect(mockedLog.mock.calls.map((c) => c[0])).toEqual(logs);
  mockedLog.mockClear();
};

const verifyFunctions = async (client, functions) => {
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

const verifyCollections = async (client, collections) => {
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

      if (e.indexes[k].queryable === undefined) {
        delete a.indexes[k].queryable;
      }
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

const verifyRoles = async (client, roles) => {
  roles = objToArray(roles);
  roles = roles
    .map(mergeDefaultMetadata)
    .sort((a, b) => (a.name > b.name ? 1 : -1));

  const actual = await client.query(fql`Role.all().order( .name ).toArray()`);
  if (roles.length !== actual.data.length) {
    expect(actual.data).toEqual(roles);
  }

  for (let i = 0; i < roles.length; i++) {
    const e = roles[i];
    const a = actual.data[i];

    expect(a.data).toEqual(e.data);
    expect(a.membership).toEqual(e.membership);
    expect(a.privileges).toEqual(e.privileges);
  }
};

module.exports = {
  verifyCollections,
  verifyFunctions,
  verifyLogs,
  verifyRoles,
};
