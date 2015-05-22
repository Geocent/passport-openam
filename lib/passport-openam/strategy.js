'use strict';

var passport = require('passport'),
    OpenAm = require('openam').OpenAm,
    util = require('util');


var OpenAmStrategy = (function () {

    /**
     * Reconstructs the original URL of the request.
     *
     * This function builds a URL that corresponds the original URL requested by the
     * client. If passing through a proxy the `X-Forwarded-*` headers are used to rebuild
     * the originating URL accessed vis the proxy.
     *
     * @param {Object} req
     * @return {String}
     * @private
     * @static
     */
    function _originalURL(req) {
      var headers = req.headers;
      if (headers['x-forwarded-host'] && headers['x-forwarded-host'].indexOf(',') > -1) {
          headers['x-forwarded-host'] = headers['x-forwarded-host'].split(',')[0];
      }
      return util.format('%s://%s%s%s',
          (req.connection.encrypted || headers['x-forwarded-proto'] === 'https') ? 'https' : 'http',
          headers['x-forwarded-host'] || headers.host,
          headers['x-forwarded-port'] ? util.format(':%s', headers['x-forwarded-port']) : '',
          req.url || ''
      );
    }

    /**
     * Sanitize options to sane values.
     *
     * @param {Object} options
     * @return {Object}
     * @private
     * @static
     */
    function _sanitizeOptions(options) {
        return {
          name: options.name || OpenAmStrategy.strategyName,
          openAmBaseUrl: options.openAmBaseUrl,
          openAmRealm: options.openAmRealm || '/',
          openAmCookieName: options.openAmCookieName || 'iPlanetDirectoryPro',
          enableLoginRedirect: options.enableLoginRedirect || false,
          enableUserAttributes: options.enableUserAttributes || false,
          callbackUrl: options.callbackUrl,
          logger: options.logger || 'error'
        };
    }

    /**
     * `OpenAmStrategy` constructor.
     *
     * @param {Object} options
     * @param {Function} verify
     * @public
     */
    var openAmStrategy = function (options, verify) {

        /**
         * Get OpenAM token from incoming request.
         *
         * @param {Object} req
         * @private
         */
        function _getOpenAmToken(req) {
          var cookies = req.cookies || {};
          return cookies[_options.openAmCookieName];
        }

        /**
         * Handles incoming invalid tokens be either redirecting the request to the OpenAM login page or failing.
         *
         * @param {Object} req
         * @param {Function} fail
         * @private
         */
        function _handleInvalidToken(req, redirect, fail) {
          if (_options.enableLoginRedirect) {
            var location = _openam.getLoginUiUrl({
              goto: _options.callbackUrl || _originalURL(req)
            });

            redirect(location);
          } else {
            return fail();
          }
        }

        /**
         * Load user attributes.
         *
         * @param {String} token
         * @param {Function} callback
         * @private
         */
        function _loadUserAttributes(token, rolesCallback, callback) {
          _openam.getAttributes(token, function (err, data) {
            if (err) {
              return callback(err);
            }

            rolesCallback(token, data, callback);
          });
        }

        function _loadRoles(token, attributes, callback) {
          var url = options.openAmBaseUrl + _openam._attributesUrl + '?subjectid=' + token;
          console.log('url:', url);

          _openam._request(url, function (err, data) {
            if (err) {
              return callback(err);
            }

            callback(null, attributes, data);
          });
        }

        /**
         * Authenticate request by delegating to a service provider using OpenAM.
         *
         * @param {Object} req
         * @public
         */
        this.authenticate = function (req) {

          var self = this;

          if (req.query && req.query.error) {
            return this.fail();
          }

          var token = _getOpenAmToken(req);
          _logger.debug('Parsed OpenAM token: %s', token);

          if (!token) {
            return _handleInvalidToken(req, self.redirect, self.fail);
          }

          _openam.isTokenValid(token, function (valid, error) {
            if(error) {
              _logger.error('Error in OpenAM token validation: %s', error);
            }

            if (!valid) {
              _logger.debug('OpenAM token %s not reported as valid.', token);
              return _handleInvalidToken(req, self.redirect, self.fail);
            }

            _logger.debug('OpenAM token %s reported as valid.', token);

            if (!_options.enableUserAttributes) {
              _logger.trace('User attributes loading disabled.');

              verify({}, function (err, user) {
                if (err) {
                  _logger.error('Unexpected error during verification: %s', err);
                  return self.error(err);
                }

                _logger.trace('OpenAM authentication complete.');
                self.success(user);
              });
            }

            _loadUserAttributes(token, _loadRoles, function (err, attributes, roles) {
              if (err) {
                _logger.error('Unexpected error loading user attributes: %s', err);
                return self.error(err);
              }

              var groups = [];
              var fields = roles.split("\n");

              for (var i = 0; i < fields.length; i++) {
                  if (fields[i].lastIndexOf("userdetails.role=id=") >= 0) {
                      var commaPos = fields[i].indexOf(',');

                      if (commaPos >= 0) {
                          var groupNameString = fields[i].substring(0, commaPos);
                          var currentGroup = groupNameString.substring(groupNameString.lastIndexOf("=") + 1);
                          groups.push(currentGroup);
                      }
                  }
              }
              attributes.groups = groups;
              console.log('attributes:', attributes);

              _logger.debug('Retrieved OpenAM attributes: %s', JSON.stringify(attributes, undefined, 2));

              verify(attributes, function (err, user) {
                if (err) {
                  _logger.error('Unexpected error during verification: %s', err);
                  return self.error(err);
                }

                _logger.trace('OpenAM authentication complete.');
                self.success(user);
              });
            });
          });
        };


        var _options = _sanitizeOptions(options || {});

        // Passport setup
        this.name = _options.name;
        passport.Strategy.call(this);

        // OpenAmStrategy setup
        var _logger = typeof(_options.logger) === 'string' ? require('tracer').colorConsole({level: _options.logger}) : _options.logger;

        _logger.debug('OpenAmStrategy options: %s', JSON.stringify(_options, undefined, 2));

        if (!_options.openAmBaseUrl) {
          throw new Error('OpenAmStrategy requires a openAmBaseUrl option.');
        }

        var _openam = new OpenAm(_options.openAmBaseUrl, _options.openAmRealm, _options.openAmCookieName);
    };

    openAmStrategy.strategyName = 'openam';

    util.inherits(openAmStrategy, passport.Strategy);

    return openAmStrategy;
})();

/**
 * Static route middleware to authenticate incoming connections.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @public
 * @static
 */
OpenAmStrategy.ensureAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else if (req._passport) {
    req._passport.instance.authenticate(OpenAmStrategy.strategyName)(req, res, next);
  }
  else {
    next(new Error('Incorrect Passport configuration.'));
  }
};

/**
 * Static route middleware to authenticate incoming connections.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @public
 * @static
 */
OpenAmStrategy.ensureAuthorized = function (roles) {
  return function (req, res, next) {
    console.log('OpenAmStrategy.ensureAuthorized: authorizing for roles: %s , method: %s , path: %j ', roles, req.method, req.originalUrl);

    if (req.isAuthenticated()) {

      var isAuthorized = false;      
      for (var r in roles) {

        if (req.user.groups.indexOf(roles[r]) >= 0) {

          isAuthorized = true;
          break;
        } 
      }
      if (isAuthorized) {
        next();
      } else {
        var err = new Error('Not Authorized: ' + req.originalUrl);
        err.code = 401;
        next(err);
      }

    }  else {
      var error = new Error('Not Authenticated.');
      error.code = 401;
      next(error);
    }
  }

};

module.exports = OpenAmStrategy;
