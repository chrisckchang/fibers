var o = require('@carbon-io/atom').o(module)
var _o = require('@carbon-io/bond')._o(module)
var testtube = require('@carbon-io/test-tube')

var __ = require('../index').__(module)

__(function() {
  module.exports = o.main({
    _type: testtube.Test,
    name: 'FibersTests',
    tests: [
      _o('./__Tests'),
      _o('./spawnTests')
    ]
  })
})
