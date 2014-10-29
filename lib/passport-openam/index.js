'use strict';

var Strategy = require('./strategy'),
	InternalOpenAmError = require('./errors/internalopenamerror');

require('pkginfo')(module, 'version');

module.exports.Strategy = Strategy;
module.exports.InternalOpenAmError = InternalOpenAmError;