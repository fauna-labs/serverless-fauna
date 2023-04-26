const { fql } = require('fauna')
const { createUpdateFunction }  = require('./function')

module.exports = ({
  functions = [],
}) => {
  const queries = [
    ...functions.map(f => createUpdateFunction(f)),
  ]

  const reduced = queries
    .filter((q) => !!q)
    .reduce((res, curr) => {
      return fql`${res}\n\n${curr}`
    }, fql`let results = []`)

  return fql`${reduced}\n\nresults`
}
