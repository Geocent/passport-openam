'use strict';

var assert = require('assert'),
    OpenAmStrategy = require('..').Strategy;

describe('passport-openam strategy tests', function () {
    it('#strategyName test', function () {
        assert.equal(OpenAmStrategy.strategyName, 'openam');
    });

    it('invalid constructor options test', function () {
      assert.throws(function () {
          new OpenAmStrategy();
      });
    });

    describe('#ensureAuthenticated test', function () {
        var req = {
            isAuthenticated: function () {
                return false;
            }
        };

        it('no passport', function () {
            assert.throws(function (){
                OpenAmStrategy.ensureAuthenticated(req);
            });
        });

        req._passport = {
            instance : {
                authenticate: function() {
                    return function (req, res, next) {
                        next();
                    };
                }
            }
        };

        it('passing with mock passport', function (done) {
            OpenAmStrategy.ensureAuthenticated(req, undefined, function () {
                done();
            });
        });

        req.isAuthenticated = function () {
            return true;
        };
        req._passport = undefined;

        it('passing with preexisting authentication', function (done) {
            OpenAmStrategy.ensureAuthenticated(req, undefined, function () {
                done();
            });
        });
    });
});
