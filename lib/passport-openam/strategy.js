'use strict';

var passport = require('passport'),
    OpenAm = require('openam').OpenAm,
    util = require('util'),
    url = require('url'),
    InternalOpenAmError = require('./errors/internalopenamerror');

/**
 * `OpenAmStrategy` constructor.
 *
 * @param {Object} options
 * @param {Function} verify
 *
 * @api public
 */
function OpenAmStrategy(options, verify) {
  options = options || {};

  if (!options.openAmBaseUrl) {
    throw new Error('OpenAmStrategy requires a openAmBaseUrl option');
  }

  passport.Strategy.call(this);

  this.name = 'openam';
  this._verify = verify;

  this._options = {
    openAmCookieName: (options.openAmCookieName === undefined) ? 'iPlanetDirectoryPro' : options.openAmCookieName,
    enableLoginRedirect: (options.enableLoginRedirect === undefined) ? false: options.enableLoginRedirect,
    enableUserProfile: (options.enableUserProfile === undefined) ? false : options.enableUserProfile,
    callbackUrl: options.callbackUrl
  };

  this._openam = new OpenAm(options.openAmBaseUrl, (options.openAmRealm === undefined) ? '/' : options.openAmRealm, this._openAmCookieName);
}

OpenAmStrategy.strategyName = 'openam';

util.inherits(OpenAmStrategy, passport.Strategy);

/**
 * Authenticate request by delegating to a service provider using OpenAM.
 *
 * @param {Object} req
 * @param {Object} options
 *
 * @api protected
 */
OpenAmStrategy.prototype.authenticate = function (req) {

  var self = this;

  if (req.query && req.query.error) {
    // TODO: Error information pertaining to OpenAM flows is encoded in the query parameters, and should be propagated to the application.
    return this.fail();
  }

  var token = this._getOpenAmToken(req);

  if (!token) {
    return this._handleInvalidToken(req);
  }

  this._openam.isTokenValid(token, function (valid) {
    if (!valid) {
      return self._handleInvalidToken(req);
    }

    if (!self._options.enableUserProfile) {
      return self.success();
    }

    self._loadUserProfile(token, function (err, profile) {
      if (err) { return self.error(err); }

      self._verify(token, profile, function (err, user, info) {
        if (err) { return self.error(err); }

        self.success(user, info);
      });
    });
  });
};

/**
 * Middleware to authenticate incoming connections.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 *
 * @api protected
 */
OpenAmStrategy.ensureAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else if (req._passport) {
    req._passport.instance.authenticate('openam')(req, res, next);
  }
  else {
    next(new Error('Incorrect Passport configuration.'));
  }
};

/**
 * Get OpenAM token from incoming request.
 *
 * @param {Object} req
 *
 * @api private
 */
OpenAmStrategy.prototype._getOpenAmToken = function (req) {

  var cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(function (cookie) {
      var parts = cookie.split('=');
      cookies[parts[0].trim()] = (parts[1] || '').trim();
    });
  }

  return cookies[this._options.openAmCookieName];
};

/**
 * Handles incoming invalid tokens be either redirecting the request to the OpenAM login page or failing.
 *
 * @param {String} token
 * @param {Function} done
 *
 * @api private
 */
OpenAmStrategy.prototype._handleInvalidToken = function (req) {
  if (this._options.enableLoginRedirect) {
    var callbackUrl = this._options.callbackUrl || req.path;

    if (!url.parse(callbackUrl).protocol) {
      // The callback URL is relative, resolve a fully qualified URL from the URL of the originating request.
      callbackUrl = url.resolve(this._originalURL(req), callbackUrl);
    }

    var location = this._openam.getLoginUiUrl({
      goto: callbackUrl
    });

    this.redirect(location);
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
OpenAmStrategy.prototype._loadUserProfile = function (token, done) {
  this._openam.getAttributes(token, function (err, data) {
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
OpenAmStrategy.prototype._originalURL = function (req) {
  var headers = req.headers;

  return util.format('%s://%s%s',
      (req.connection.encrypted || headers['x-forwarded-proto'] === 'https') ? 'https' : 'http',
      headers.host,
      req.url || ''
  );
};

module.exports = OpenAmStrategy;
