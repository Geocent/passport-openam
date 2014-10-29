'use strict';

var passport = require('passport'),
    OpenAm = require('openam').OpenAm,
    util = require('util'),
    url = require('url'),
    InternalOpenAmError = require('./errors/internalopenamerror');

var OpenAmStrategy = (function () {

    /**
     * Get OpenAM token from incoming request.
     *
     * @param {Object} req
     *
     * @api private
     */
    function _getOpenAmToken(req, options) {

      var cookies = {};
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(function (cookie) {
          var parts = cookie.split('=');
          cookies[parts[0].trim()] = (parts[1] || '').trim();
        });
      }

      return cookies[options.openAmCookieName];
    };

    /**
     * Handles incoming invalid tokens be either redirecting the request to the OpenAM login page or failing.
     *
     * @param {String} token
     * @param {Function} done
     *
     * @api private
     */
    function _handleInvalidToken(req, options, openam, context) {
      if (options.enableLoginRedirect) {
        var callbackUrl = options.callbackUrl || req.path;

        if (!url.parse(callbackUrl).protocol) {
          // The callback URL is relative, resolve a fully qualified URL from the URL of the originating request.
          callbackUrl = url.resolve(_originalURL(req), callbackUrl);
        }

        var location = openam.getLoginUiUrl({
          goto: callbackUrl
        });
        context.redirect(location);
      } else {
        return this.fail();
      }
    };

    /**
     * Load user profile in accordinace to the normalized Portable Contacts
     * contact schema prefered by Passport.
     *
     * @see http://portablecontacts.net/draft-spec.html#schema
     *
     * @param {String} token
     * @param {Function} done
     *
     * @api private
     */
    function _loadUserProfile(token, openam, done) {
      openam.getAttributes(token, function (err, data) {
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
    };

    /**
     * Reconstructs the original URL of the request.
     *
     * This function builds a URL that corresponds the original URL requested by the
     * client, including the protocol (http or https) and host.
     *
     * If the request passed through any proxies that terminate SSL, the
     * `X-Forwarded-Proto` header is used to detect if the request was encrypted to
     * the proxy.
     *
     * @param {Object} req
     *
     * @return {String}
     *
     * @api private
     */
    function _originalURL(req) {
      var headers = req.headers;

      return util.format('%s://%s%s',
          (req.connection.encrypted || headers['x-forwarded-proto'] === 'https') ? 'https' : 'http',
          headers.host,
          req.url || ''
      );
    };

    /**
     * `OpenAmStrategy` constructor.
     *
     * @param {Object} options
     * @param {Function} verify
     *
     * @api public
     */
    var openAmStrategy = function (options, verify) {
        options = options || {};

        if (!options.openAmBaseUrl) {
          throw new Error('OpenAmStrategy requires a openAmBaseUrl option');
        }

        options = {
          openAmBaseUrl: options.openAmBaseUrl,
          openAmRealm: (options.openAmRealm === undefined) ? '/' : options.openAmRealm,
          openAmCookieName: (options.openAmCookieName === undefined) ? 'iPlanetDirectoryPro' : options.openAmCookieName,
          enableLoginRedirect: (options.enableLoginRedirect === undefined) ? false: options.enableLoginRedirect,
          enableUserProfile: (options.enableUserProfile === undefined) ? false : options.enableUserProfile,
          callbackUrl: options.callbackUrl
        };

        var openam = new OpenAm(options.openAmBaseUrl, options.openAmRealm, options.openAmCookieName);

        passport.Strategy.call(this);

        this.name = openAmStrategy.strategyName;

        /**
         * Authenticate request by delegating to a service provider using OpenAM.
         *
         * @param {Object} req
         * @param {Object} options
         *
         * @api public
         */
        this.authenticate = function (req) {

          var self = this;

          if (req.query && req.query.error) {
            // TODO: Error information pertaining to OpenAM flows is encoded in the query parameters, and should be propagated to the application.
            return this.fail();
          }

          var token = _getOpenAmToken(req, options);

          if (!token) {
            return _handleInvalidToken(req, options, openam, this);
          }

          openam.isTokenValid(token, function (valid) {
            if (!valid) {
              return _handleInvalidToken(req, options, openam, this);
            }

            if (!options.enableUserProfile) {
              return self.success();
            }

            _loadUserProfile(token, openam, function (err, profile) {
              if (err) { return self.error(err); }

              verify(token, profile, function (err, user, info) {
                if (err) { return self.error(err); }

                self.success(user, info);
              });
            });
          });
        };
    }

    openAmStrategy.strategyName = 'openam';

    util.inherits(constructor, passport.Strategy);

    return openAmStrategy;
})();

/**
 * Static route middleware to authenticate incoming connections.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 *
 * @api public static
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
