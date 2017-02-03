var assert = require('assert')

var debug = require('debug')
var mockery = require('mockery')
var sinon = require('sinon')

var o = require('@carbon-io/atom').o(module).main
var oo = require('@carbon-io/atom').oo(module)
var _o = require('@carbon-io/bond')._o(module)
var testtube = require('@carbon-io/test-tube')

var spawn = undefined

var FiberSpy = require('./util').FiberSpy
var debugSpy = function(namespace) {
  debugSpy.spy = sinon.spy(debug(namespace))
  return debugSpy.spy
}

mockery.registerMock('fibers', FiberSpy)
mockery.registerMock('debug', debugSpy)

var SpawnTest = oo({
  _type: testtube.Test,
  _C: function() {
    this.mod = module
  },
  setup: function() {
    this.parent._setup(this.mod)
  },
  teardown: function() {
    this.parent._teardown()
  }
})

module.exports = o({
  _type: testtube.Test,
  name: 'spawnTests',
  description: 'spawn tests',
  _setup: function(mod) {
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false,
      warnOnReplace: false
    })
    spawn = require('../index').spawn
    this.spawnFibersLength = spawn._fibers._length
  },
  _teardown: function() {
    mockery.disable()
    assert.equal(spawn._fibers._length, this.spawnFibersLength)
    spawn = undefined
    FiberSpy.resetAll()
    debugSpy.spy.reset()
  },
  tests: [
    // spawn tests
    o({
      _type: SpawnTest,
      name: 'noCallbacks',
      doTest: function() {
        var result = spawn(function() {
          return 1
        })
        assert.equal(result, 1)
        assert.equal(FiberSpy.callCount, 1)
        var fiberSpy = FiberSpy.returnValues[0]
        assert.equal(fiberSpy.run.callCount, 1)
        assert.equal(FiberSpy.yield.callCount, 0)
      }
    }),
    o({
      _type: SpawnTest,
      name: 'noCallbacksException',
      doTest: function() {
        var self = this
        assert.throws(function() {
          spawn(function() {
            throw new Error(self.name)
          })
        }, Error)
        assert.equal(FiberSpy.callCount, 1)
        var fiberSpy = FiberSpy.returnValues[0]
        assert.equal(fiberSpy.run.callCount, 1)
        assert.equal(FiberSpy.yield.callCount, 0)
      }
    }),
    o({
      _type: SpawnTest,
      name: 'errorCallback',
      doTest: function() {
        var error = undefined
        var result = spawn(function() {
          return 1
        }, undefined, function(err) {
          error = err
        })
        assert.equal(result, 1)
        assert.equal(FiberSpy.callCount, 1)
        var fiberSpy = FiberSpy.returnValues[0]
        assert.equal(fiberSpy.run.callCount, 1)
        assert.equal(FiberSpy.yield.callCount, 0)
      }
    }),
    o({
      _type: SpawnTest,
      name: 'errorCallbackException',
      doTest: function(done) {
        var self = this
        var result = spawn(function() {
          throw new Error(self.name)
        }, undefined, function(err) {
          try {
            assert(err instanceof Error)
            assert.equal(err.message, self.name)
            assert.equal(FiberSpy.callCount, 1)
            var fiberSpy = FiberSpy.returnValues[0]
            assert.equal(fiberSpy.run.callCount, 1)
            assert(!FiberSpy.yield.called)
          } catch (e) {
            done = done.bind(undefined, e)
          } finally {
            setImmediate(done)
          }
        })
      }
    }),
    o({
      _type: SpawnTest,
      name: 'nextCallback',
      doTest: function(done) {
        var result = undefined
        spawn(function() {
          return 1
        }, function(result) {
          try {
            assert.equal(result, 1)
            assert.equal(FiberSpy.callCount, 1)
            var fiberSpy = FiberSpy.returnValues[0]
            assert.equal(fiberSpy.run.callCount, 1)
            assert.equal(FiberSpy.yield.callCount, 0)
          } catch (e) {
            done = done.bind(undefined, e)
          } finally {
            setImmediate(done)
          }
        })
        // run on nextTick
        var fiberSpy = FiberSpy.returnValues[0]
        assert.equal(fiberSpy.run.callCount, 0)
      }
    }),
    o({
      _type: SpawnTest,
      name: 'nextCallbackException',
      doTest: function(done) {
        var self = this
        var nextSpy = sinon.spy()
        assert.doesNotThrow(function() {
          spawn(function() {
            throw new Error(self.name)
          }, nextSpy)
        }, Error)
        setImmediate(function() {
          // should run after nextTick
          try {
            assert.equal(FiberSpy.callCount, 1)
            var fiberSpy = FiberSpy.returnValues[0]
            assert.equal(fiberSpy.run.callCount, 1)
            assert(!FiberSpy.yield.called)
            assert.equal(debugSpy.spy.callCount, 2)
          } catch (e) {
            done = done.bind(undefined, e)
          } finally {
            done()
          }
        })
      }
    }),
    o({
      _type: SpawnTest,
      name: 'nextAndErrorCallback',
      doTest: function(done) {
        var result = undefined
        var error = undefined
        var errorSpy = sinon.spy()
        spawn(function() {
            return 1
          }, function(result) {
            try {
              assert.equal(result, 1)
              assert.equal(FiberSpy.callCount, 1)
              var fiberSpy = FiberSpy.returnValues[0]
              assert.equal(fiberSpy.run.callCount, 1)
              assert.equal(FiberSpy.yield.callCount, 0)
            } catch (e) {
              error = e
            } finally {
              setImmediate(function() {
                try {
                  assert(!errorSpy.called)
                } catch (e) {
                  error = e
                }
                done(error)
              })
            }
          }, 
          errorSpy
        )
        try {
          // run on nextTick
          var fiberSpy = FiberSpy.returnValues[0]
          assert.equal(fiberSpy.run.callCount, 0)
        } catch (e) {
          error = e
        }
      }
    }),
    o({
      _type: SpawnTest,
      name: 'nextAndErrorCallbackException',
      doTest: function(done) {
        var self = this
        var error = undefined
        var nextSpy = sinon.spy()
        assert.doesNotThrow(function() {
          spawn(function() {
              throw new Error(self.name)
            }, 
            nextSpy,
            function(err) {
              try {
                assert.equal(FiberSpy.callCount, 1)
                var fiberSpy = FiberSpy.returnValues[0]
                assert.equal(fiberSpy.run.callCount, 1)
                assert(!FiberSpy.yield.called)
                assert.equal(debugSpy.spy.callCount, 1)
              } catch (e) {
                error = e
              } finally {
                setImmediate(function() {
                  try {
                    assert(!nextSpy.called)
                  } catch (e) {
                    error = e
                  }
                  done(error)
                })
              }
            }
          )
        }, Error)
      }
    }),
    o({
      _type: SpawnTest,
      name: 'syncCallWithNestedAsyncCallUsingFutures',
      doTest: function(done) {
        var self = this
        var error = undefined
        var val = spawn(
          function() {
            var asyncFunc = function(cb) {
              process.nextTick(function() {
                cb(null, 1)
              })
            }
            return asyncFunc.sync.call(this)
          })
        try {
          assert.equal(val, 1)
        } catch (e) {
          error = e
        }
        process.nextTick(function() {
          // this lets the spawned fiber run out so the spawn.fibers test in 
          // parent._teardown succeeds
          done(error)
        })
      }
    })
  ]
})
