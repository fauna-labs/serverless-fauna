const { fql } = require('fauna')
const { createUpdateFunction }  = require('./function')

module.exports = ({
  functions = [],
}) => {
  const queries = [
    ...functions.map(f => createUpdateFunction(f)),
  ]

  return fql`${queries}`
}
