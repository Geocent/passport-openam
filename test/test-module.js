'use strict';

var assert = require('assert'),
    OpenAm = require('..');

describe('passport-openam module tests.', function () {
    it('version test', function () {
        assert.equal(typeof(OpenAm.version), 'string');
    });
});
