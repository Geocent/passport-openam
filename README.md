# Passport-OpenAM

General-purpose [OpenAM](http://forgerock.com/products/open-identity-stack/openam/) authentication strategies for [Passport](https://github.com/jaredhanson/passport).

OpenAM is an open source access management, entitlements and federation server platform.

This module lets you authenticate using OpenAM in your Node.js applications.
By plugging into Passport, OpenAM authentication can be easily and unobtrusively
integrated into any application or framework that supports
[Connect](http://www.senchalabs.org/connect/)-style middleware, including
[Express](http://expressjs.com/).

This development branch is based off of the [original module](https://github.com/alesium/passport-openam) developed by [Sebastien Perreault](https://github.com/sperreault) with [fixes](https://github.com/marksyzm/passport-openam) provided by [Mark Elphinstone-Hoadley](https://github.com/marksyzm). The goal of this fork is to provide a more generalized implementation applicable for protecting REST resources.

## Installation

Add the passport-openam module to the `dependencies` section of your project's `package.json` file via the project's Github id:

```
...
"dependencies" : {
    "passport-openam": "Geocent/passport-openam"
}
...
```

## API

### OpenAmStrategy(`options`, `verify`)

OpenAM Passport strategy constructor.

* `options` - (Object) A configuration object for the strategy setting necessary options.
    * `openAmBaseUrl` - (String) Base URL for the OpenAM instance with which to authenticate.
    * `openAmRealm` - (String) Realm for the relevant application. `Default: /`
    * `openAmCookieName` - (String) Cookie name for the OpenAM instance. `Default: iPlanetDirectoryPro`
    * `enableLoginRedirect` - (Boolean) Enable redirecting the user to the OpenAM login page if they are not logged in or their token is invalid. If `false` the strategy will immediately return a `401 Unauthorized` if the user is not logged in of the provided token is invalid. `Default: false`
    * `enableUserProfile` - (Boolean) Enable fetching the user profile from OpenAM. `Default: false`
    * `callbackUrl` - (String) Global callback URL to redirect the user after a successful login with OpenAM. If not present the user will be redirected back to the originating URL.
    * `logger` - (String) Sets the logging level of the [tracer](https://github.com/baryon/tracer) logging mechanism. Supported levels are: `error`, `warn`, `info`, `debug`, `trace`, `log`. `Default: error`
* `verify` - (Function(token, profile, done)) Verification callback to execute upon successful verification of the user's OpenAM token.

Example:
```javascript
new OpenAmStrategy({
    openAmBaseUrl: 'http://idp.example.com/OpenAM/',
    enableLoginRedirect: true,
    enableUserProfile: true,
    logger: 'debug'
  },
  function(token, profile, done) {
    return done(null, profile);
  }
); // -> [object OpenAmStrategy]
```

### OpenAmStrategy.strategyName

Static property declaring the name of the strategy.

Example:
```javascript
OpenAmStrategy.strategyName; // -> 'openam'
```

### OpenAmStrategy.ensureAuthenticated(`req`, `res`, `next`)

Static route middleware function to authenticate incoming connections for use with Express routing declarations. This function will skip reauthentication if it detects that the user was previously authenticated with this specific middleware.

* `req` - (Object) Incoming request object.
* `res` - (Object) Outgoing response object.
* `next` - (Function(req, res, next)) Next middleware to execute on successful authentication.

Example:
```javascript
app.get('/protected', OpenAmStrategy.ensureAuthenticated, function (req, res) {
  res.json(req.user);
});
```

## Usage

1. Once installed into your project as described via the [Installation](#installation) section simply `require` the module's `Strategy` property.

 ```javascript
 var OpenAmStrategy = require('passport-openam').Strategy;
 ```

2. If Passport sessions are enabled you can store and retrieve the fetched user profile (if enabled) to and from the session using the Passport `serialize` and `deserialize` functions.

 ```javascript
 passport.serializeUser(function(user, done) {
     done(null, user);
 });

 passport.deserializeUser(function(obj, done) {
     done(null, obj);
 });
 ```

3. Instantiate the `OpenAmStrategy` object with desired options and add it to the passport authentication chain.

 ```javascript
 passport.use(new OpenAmStrategy({
       openAmBaseUrl: 'http://idp.example.com/OpenAM/',
       enableLoginRedirect: true,
       enableUserProfile: true
     },
     function(token, profile, done) {
       return done(null, profile);
     }
 ));
 ```

4. Ensure that the Passport middleware is initialized and added to the Express middleware chain.

 ```javascript
 app.use(passport.initialize());
 app.use(passport.session());
 ```

5. Utilize the included route middleware to authenticate and protect desired URLs.
 ```javascript
 app.get('/protected', OpenAmStrategy.ensureAuthenticated, function (req, res) {
     res.json(req.user);
 });
 ```

 Alternately you can create your own route middleware utilizing the `OpenAmStrategy` authenticator that has been previously added to the Passport authentication chain.

 ```javascript
 function customRouteMiddleware(req, res, next) {
     console.log('Authentication attempt logging.');
     passport.authenticate(OpenAmStrategy.strategyName)(req, res, next);
 }
 app.get('/protected', customRouteMiddleware, function (req, res) {
     res.json(req.user);
 });
 ```

## Examples

### `examples/simple`

Simple example showing full creation of Express application with passport-openam authentication for several routes.

```
  Usage: node app.js [options]

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -p, --port [port number]  interface port to open [3000]
    -b, --base [base url]     Base URL for the OpenAM instance
```

## Release Notes

### 0.0.4
* Updates to include support for headless interfaces such as REST endpoints.
* Test framework updates.
* Example update to Express 4 and additional endpoints.
* Source code documentation and JsLint compliance.

## Credits

  - [Mark Elphinstone-Hoadley](https://github.com/marksyzm)
  - [Jared Hanson](https://github.com/jaredhanson)
  - [Sebastien Perreault](https://github.com/sperreault)

## License

(The MIT License)

Copyright (c) 2014 Geocent

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
