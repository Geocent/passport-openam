'use strict';

var bodyParser      = require('body-parser'),
    cookieParser    = require('cookie-parser'),
    commander       = require('commander'),
    express         = require('express'),
    session         = require('express-session'),
    morgan          = require('morgan'),
    passport        = require('passport'),
    OpenAmStrategy  = require('..').Strategy;

commander
    .version(require('./package.json').version)
    .option('-p, --port [port number]', 'interface port to open [3000]', 3000)
    .option('-b, --base [base url]', 'Base URL for the OpenAM instance', 'http://localhost:8080/OpenAM/')
    .parse(process.argv);

// Passport session setup.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

// Create OpenAM Passport stategy
console.info('Creating OpenAM strategy with base URL: %s', commander.base);

passport.use(new OpenAmStrategy({
    name: 'openam-fetch',
    openAmBaseUrl: commander.base,
    enableLoginRedirect: true,
    enableUserAttributes: true,
    logger: 'trace'
  },
  function(attributes, done) {
    return done(null, attributes);
  }
));

var CustomLogger = function () {
    this.decorate = function(args, prepend) {
        args[0] = prepend + args[0];
        return args;
    };

    this.log   = function () { console.log.apply(this, this.decorate(arguments, '[LOG]: ')); };
    this.trace = function () { console.log.apply(this, this.decorate(arguments, '[TRACE]: ')); };
    this.info  = function () { console.log.apply(this, this.decorate(arguments, '[INFO]: ')); };
    this.debug = function () { console.log.apply(this, this.decorate(arguments, '[DEBUG]: ')); };
    this.warn  = function () { console.log.apply(this, this.decorate(arguments, '[ERROR]: ')); };
};

passport.use(new OpenAmStrategy({
    name: 'openam-do-not-fetch',
    openAmBaseUrl: commander.base,
    enableLoginRedirect: true,
    enableUserAttributes: false,
    logger: new CustomLogger()
  },
  function(attributes, done) {
    return done(null, attributes);
  }
));

// Express application setup
var app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: 'klaatu barada nikto',
  resave: true,
  saveUninitialized: true
}));
app.use(morgan('dev'));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'jade');

app.locals.pageTitle = 'multiple';

// Unprotected URL
app.get('/', function (req, res) {
  res.render('response', {
      links: [
        '/fetch',
        '/ignore'
      ]
  });
});
// Unprotected URL
app.get('/', function (req, res) {
  res.render('response', {
      links: [
        '/fetch',
        '/ignore'
      ]
  });
});

// User Attribtues Fetch URL
function customAttributeFetchMiddleware(req, res, next) {
  passport.authenticate('openam-fetch')(req, res, next);
}

app.get('/fetch', customAttributeFetchMiddleware, function (req, res) {
  res.render('response', {
      attributes: req.user
  });
});

// User Attribtues Ignore URL With Custom Logging
function customAttributeIgnoreMiddleware(req, res, next) {
  passport.authenticate('openam-do-not-fetch')(req, res, next);
}

app.get('/ignore', customAttributeIgnoreMiddleware, function (req, res) {
  res.render('response', {
      attributes: req.user
  });
});

var server = app.listen(commander.port, function () {
    console.info('Example application started on port %d.', server.address().port);
    console.info('Access protected resources at: http://localhost:%d/fetch and http://localhost:%d/ignore', server.address().port, server.address().port);
});
