'use strict';

var assert = require('assert'),
    InternalOpenAmError = require('..').InternalOpenAmError;

describe('InternalOpenAmError tests.', function () {
    it('when constructed with only a message', function () {
        var err = new InternalOpenAmError('oops');
    assert.equal(err.toString(), 'oops');
    });

    it('when constructed with a message and error', function () {
        var err = new InternalOpenAmError('oops', new Error('something is wrong'));
        assert.equal(err.toString(), 'oops (Error: something is wrong)');
    });

    it('when constructed with a message and error', function () {
    var err = new InternalOpenAmError('oops', { statusCode: 401, data: 'invalid OAuth credentials' });
        assert.equal(err.toString(), 'oops (status: 401 data: invalid OAuth credentials)');
    });
});
