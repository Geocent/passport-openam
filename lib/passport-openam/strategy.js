'use strict';

var passport = require('passport'),
    OpenAm = require('openam').OpenAm,
    util = require('util'),
    url = require('url'),
    InternalOpenAmError = require('./errors/internalopenamerror');

var OpenAmStrategy = (function () {

    /**
     * Reconstructs the original URL of the request.
     *
     * This function builds a URL that corresponds the original URL requested by the
     * client, including the protocol (http or https) and host.
     * If the request passed through any proxies that terminate SSL, the
     * `X-Forwarded-Proto` header is used to detect if the request was encrypted to
     * the proxy.
     *
     * @param {Object} req
     * @return {String}
     * @api private
     * @static
     */
    function _originalURL(req) {
      var headers = req.headers;

      return util.format('%s://%s%s',
          (req.connection.encrypted || headers['x-forwarded-proto'] === 'https') ? 'https' : 'http',
          headers.host,
          req.url || ''
      );
    }

    /**
     * Sanitize options to sane values.
     *
     * @param {Object} options
     * @return {Object}
     * @api private
     * @static
     */
    function _sanitizeOptions(options) {
        return {
          openAmBaseUrl: options.openAmBaseUrl,
          openAmRealm: (options.openAmRealm === undefined) ? '/' : options.openAmRealm,
          openAmCookieName: (options.openAmCookieName === undefined) ? 'iPlanetDirectoryPro' : options.openAmCookieName,
          enableLoginRedirect: (options.enableLoginRedirect === undefined) ? false: options.enableLoginRedirect,
          enableUserProfile: (options.enableUserProfile === undefined) ? false : options.enableUserProfile,
          callbackUrl: options.callbackUrl,
          logger: (options.logger === undefined) ? 'error' : options.logger
        };
    }

    /**
     * `OpenAmStrategy` constructor.
     *
     * @param {Object} options
     * @param {Function} verify
     * @api public
     */
    var openAmStrategy = function (options, verify) {

        /**
         * Get OpenAM token from incoming request.
         *
         * @param {Object} req
         * @api private
         */
        function _getOpenAmToken(req) {

          var cookies = {};
          if (req.headers.cookie) {
            req.headers.cookie.split(';').forEach(function (cookie) {
              var parts = cookie.split('=');
              cookies[parts[0].trim()] = (parts[1] || '').trim();
            });
          }

          return cookies[_options.openAmCookieName];
        }

        /**
         * Handles incoming invalid tokens be either redirecting the request to the OpenAM login page or failing.
         *
         * @param {Object} req
         * @param {Function} fail
         * @api private
         */
        function _handleInvalidToken(req, redirect, fail) {
          if (_options.enableLoginRedirect) {
            var callbackUrl = _options.callbackUrl || req.path;

            if (!url.parse(callbackUrl).protocol) {
              // The callback URL is relative, resolve a fully qualified URL from the URL of the originating request.
              callbackUrl = url.resolve(_originalURL(req), callbackUrl);
            }

            var location = _openam.getLoginUiUrl({
              goto: callbackUrl
            });
            redirect(location);
          } else {
            return fail();
          }
        }

        /**
         * Load user profile in accordinace to the normalized Portable Contacts
         * contact schema prefered by Passport.
         *
         * @see http://portablecontacts.net/draft-spec.html#schema
         * @param {String} token
         * @param {Function} done
         * @api private
         */
        function _loadUserProfile(token, done) {
          _openam.getAttributes(token, function (err, data) {
            if (err) {
              return done(new InternalOpenAmError('Failed to retrieve user attributes.', err));
            }

            var profile = {
              id: data.tokenid,
              username: data.uid,
              displayName: data.cn,
              name: {
                familyName: data.sn,
                givenName: data.givenname
              },
              email: data.mail,
              _raw: data
            };

            done(null, profile);
          });
        }

        /**
         * Authenticate request by delegating to a service provider using OpenAM.
         *
         * @param {Object} req
         * @param {Object} options
         * @api public
         */
        this.authenticate = function (req) {

          var self = this;

          if (req.query && req.query.error) {
            // TODO: Error information pertaining to OpenAM flows is encoded in the query parameters, and should be propagated to the application.
            return this.fail();
          }

          var token = _getOpenAmToken(req);
          _logger.debug('Parsed OpenAM token: %s', token);

          if (!token) {
            return _handleInvalidToken(req, self.redirect, self.fail);
          }

          _openam.isTokenValid(token, function (valid) {
            if (!valid) {
              _logger.debug('OpenAM token %s not reported as valid.', token);
              return _handleInvalidToken(req, self.redirect, self.fail);
            }

            _logger.debug('OpenAM token %s reported as valid.', token);

            if (!_options.enableUserProfile) {
              _logger.trace('User profile fetching disabled.');

              verify(token, {}, function (err, user) {
                if (err) {
                  _logger.error('Unexpected error during verification: %s', err);
                  return self.error(err);
                }

                _logger.trace('OpenAM authentication complete.', token);
                self.success(user);
              });
            }

            _loadUserProfile(token, function (err, profile) {
              if (err) {
                _logger.error('Unexpected error retrieving user profile: %s', err);
                return self.error(err);
              }

              _logger.debug('Retrieved OpenAM profile: %s', JSON.stringify(profile));

              verify(token, profile, function (err, user) {
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

        // Passport setup
        this.name = openAmStrategy.strategyName;
        passport.Strategy.call(this);

        // OpenAmStrategy setup
        var _options = _sanitizeOptions(options || {});

        if (!_options.openAmBaseUrl) {
          throw new Error('OpenAmStrategy requires a openAmBaseUrl option.');
        }

        var _openam = new OpenAm(_options.openAmBaseUrl, _options.openAmRealm, _options.openAmCookieName);
        var _logger = require('tracer').console({level: _options.logger});
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
 *
 * @api public
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

module.exports = OpenAmStrategy;
