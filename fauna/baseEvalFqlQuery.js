const { query } = require('faunadb')
const { parse } = require("acorn")
module.exports = (code) => {
  const ast = parse(code, { ecmaVersion: 2020 });

  if (ast.body.length != 1 || ast.body[0].expression.callee.name != "Lambda") {
    throw new Error('FQL must have 1 `Lambda` query');
  }

  return query.Query(evalWithContext(query, code))
}

function evalWithContext(context, expression) {
  const variables = Object.keys(context)

  // function and arguments are keywords, so I use abbreviated names
  const func = new Function(...variables, `return (${expression})`)

  const args = variables.map((arg) =>
    Object.hasOwnProperty.call(context, arg) ? context[arg] : undefined
  )

  return func(...args)
}
