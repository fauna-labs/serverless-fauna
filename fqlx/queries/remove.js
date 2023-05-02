const { fql } = require('fauna')
const { removeFunctionsExcept }  = require('./function')

module.exports = ({
  functions = [],
}) => {
  const queries = [
    removeFunctionsExcept(functions),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}
