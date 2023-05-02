const { fql } = require('fauna')
const { createUpdateFunction }  = require('./function')

module.exports = ({
  functions = [],
}) => {
  const queries = [
    ...functions.map(f => createUpdateFunction(f)),
  ]

  const result =queries.reduce((prev, curr) => {
    if (prev === null) {
      return fql`[${curr}`
    }
    return fql`${prev}, ${curr}`
  }, null)

  return fql`${result}]`
}
