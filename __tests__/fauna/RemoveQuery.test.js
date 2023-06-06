const config = require("../config");
const getClient = require("../../fauna/v4/client");
const { GetAllResourcesRefs } = require("../../fauna/v4/utility");
const { query: q } = require("faunadb");
const { defaultData } = require("../test.data");
const RemoveQuery = require("../../fauna/v4/RemoveQuery");

describe("RemoveQuery", () => {
  const rootClient = getClient(config);
  let testClient;

  beforeAll(async () => {
    const response = await rootClient.query(
      q.Let(
        {
          database: q.CreateDatabase({ name: randomString("db_") }),
          key: q.CreateKey({
            database: q.Select(["ref"], q.Var("database")),
            role: "admin",
          }),
        },
        {
          secret: q.Select(["secret"], q.Var("key")),
          keyRef: q.Select(["ref"], q.Var("key")),
          dbRef: q.Select(["ref"], q.Var("database")),
        }
      )
    );

    keyRef = response.keyRef;
    dbRef = response.dbRef;

    testClient = new getClient({ ...config, secret: response.secret });
  });

  afterEach(() => {
    return testClient.query(
      q.Map(GetAllResourcesRefs(), (ref) => q.Delete(ref))
    );
  });

  afterAll(async () => {
    rootClient.close();
    testClient.close();
  });

  test("deletion_policy = retain", async () => {
    await testClient.query(
      q.Map([randomString("users"), randomString("logs")], (name) =>
        q.CreateCollection({
          name,
          data: { ...defaultData, deletion_policy: "retain" },
        })
      )
    );

    await testClient.query(RemoveQuery());

    const result = await testClient.query(q.Paginate(q.Collections()));
    expect(result.data.length).toEqual(2);
  });

  test("deletion_policy = destroy", async () => {
    await testClient.query(
      q.Map([randomString("users"), randomString("logs")], (name) =>
        q.CreateCollection({
          name,
          data: { ...defaultData, deletion_policy: "destroy" },
        })
      )
    );

    await testClient.query(RemoveQuery());

    const result = await testClient.query(q.Paginate(q.Collections()));
    expect(result.data.length).toEqual(0);
  });

  test("different deletion_policy", async () => {
    await testClient.query(
      q.Let(
        {
          collection: q.CreateCollection({
            name: "users",
            data: { ...defaultData, deletion_policy: "retain" },
          }),
          function: q.CreateFunction({
            name: "test",
            body: q.Query(q.Lambda((x) => x)),
            data: { ...defaultData, deletion_policy: "destroy" },
          }),
          role: q.CreateRole({
            name: "test",
            privileges: [],
            data: { ...defaultData, deletion_policy: "destroy" },
          }),
        },
        q.Var("collection")
      )
    );

    await testClient.query(RemoveQuery());

    const result = await testClient.query(GetAllResourcesRefs());
    expect(result.length).toEqual(1);
  });
});

function randomString(prefix) {
  var rand = ((Math.random() * 0xffffff) << 0).toString(16);
  return (prefix || "") + rand;
}
