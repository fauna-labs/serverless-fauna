const objToArray = (obj) => {
  return Object.entries(obj).map(([k, v]) => {
    return {
      name: k,
      ...v,
    };
  });
};

const mergeDefaultMetadata = (f) => {
  const md = {
    created_by_serverless_plugin: "fauna:v10",
    deletion_policy: "destroy",
  };
  const merged = { ...md, ...f.data };
  return {
    ...f,
    data: merged,
  };
};

module.exports = { mergeDefaultMetadata, objToArray };
