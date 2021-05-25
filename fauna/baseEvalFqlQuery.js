const { query } = require('faunadb')
module.exports = (codes) => {
  return query.Query(evalWithContext(query, parseQuery(codes)))
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

function parseQuery(code) {
  const brackets = {
    '{': '}',
    '(': ')',
    '[': ']',
    '"': '"',
    "'": "'",
  }
  const openBrackets = new Set(Object.keys(brackets))
  const closeBrackets = new Set(Object.values(brackets))
  const queries = []
  const stack = []
  let start = 0
  let isOpening
  code = code.trim()

  for (let i = 0; i < code.length; i++) {
    if (openBrackets.has(code[i])) {
      stack.push(code[i])
      isOpening = true
    }

    if (closeBrackets.has(code[i]) && brackets[stack.pop()] !== code[i]) {
      throw new Error(
        `Unexpected closing bracket ${code[i]} at position: ${i + 1}`
      )
    }

    if (stack.length === 0 && isOpening) {
      queries.push(code.slice(start, i + 1))
      start = i + 1
      isOpening = false
    }
  }

  if (isOpening) {
    throw new Error('Expect all opened brackets to be closed')
  }

  if (queries.length !== 1 || queries[0].substr(0, 6) !== 'Lambda')
    throw new Error('FQL must have 1 `Lambda` query')

  return queries[0]
}
