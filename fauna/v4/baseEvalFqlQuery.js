const { query } = require("faunadb");
module.exports = (codes) => {
  return query.Query(evalWithContext(query, parseQuery(codes)));
};

function evalWithContext(context, expression) {
  const variables = Object.keys(context);

  // function and arguments are keywords, so I use abbreviated names
  const func = new Function(...variables, `return (${expression})`);

  const args = variables.map((arg) =>
    Object.hasOwnProperty.call(context, arg) ? context[arg] : undefined
  );

  return func(...args);
}

function parseQuery(code) {
  const brackets = {
    "{": "}",
    "(": ")",
    "[": "]",
    '"': '"',
    "'": "'",
  };
  const openBrackets = new Set(Object.keys(brackets));
  const closeBrackets = new Set(Object.values(brackets));
  const newLines = new Set(["\r", "\n"]);
  const queries = [];
  const stack = [];
  let inQuery = false;
  let curQuery = "";
  let inLineComment;
  let inBlockComment;
  code = code.trim();

  for (let i = 0; i < code.length; i++) {
    if (inLineComment) {
      if (newLines.has(code[i])) {
        inLineComment = false;
      }
      continue;
    }
    if (inBlockComment) {
      if (code[i] == "*" && code[i + 1] == "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (code[i] == "/") {
      if (code[i + 1] == "/") {
        inLineComment = true;
        i += 1;
      } else if (code[i + 1] == "*") {
        inBlockComment = true;
        i += 1;
      }

      if (inLineComment || inBlockComment) {
        continue;
      }
    }

    if (inQuery) {
      curQuery += code[i];

      if (openBrackets.has(code[i])) {
        stack.push(code[i]);
      }

      if (closeBrackets.has(code[i])) {
        if (brackets[stack.pop()] !== code[i]) {
          throw new Error(
            `Unexpected closing bracket ${code[i]} at position: ${i + 1}`
          );
        } else if (stack.length === 0) {
          queries.push(curQuery);
          inQuery = false;
        }
      }

      continue;
    }

    if (code.substr(i, 6) === "Lambda") {
      inQuery = true;
      curQuery = "Lambda";
      i += 5;
    }
  }

  if (queries.length !== 1) throw new Error("FQL must have 1 `Lambda` query");

  return queries[0];
}
