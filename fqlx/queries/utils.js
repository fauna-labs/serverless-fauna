const { fql } = require('fauna')


/**
 * A helper function to guard against FQL injection when constructing FQL literals from variables.
 *
 * @param ident An identifier
 * @returns An FQL X Query
 */
function fqlIdent(ident) {
  if (ident.match(/^[A-Za-z_][A-Za-z0-9_]*$/) != null) {
    return fql([ident]);
  } else {
    throw Error(`Invalid identifier '${ident}'`);
  }
}

// TODO: General use predicate builder if required.
/**
 * Takes a variable name and an object of k/v pairs and builds an and
 * predicate.
 *
 * Example:
 *   variable: f
 *   obj: { name: "Scout", species: "Dog" }
 *
 *   return: fql(`f.name == "Scout" && f.species == "Dog"`)
 *
 * @param variable A variable prefix for the left side of the predicates
 * @param obj An object of k/v pairs
 * @returns An FQL Query
 */
const and = (variable, obj) => {
  return Object.entries(obj)
    .map(([k, v]) => fql`${fqlIdent(variable)}.${fqlIdent(k)} == ${v}`)
    .reduce((result, curr) => {
      if (result == null) {
        return curr
      } else {
        return fql`${result} && ${curr}`
      }
    }, null)
}

module.exports = {
  and,
}
