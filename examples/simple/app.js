'use strict';

var bodyParser      = require('body-parser'),
    cookieParser    = require('cookie-parser'),
    commander       = require('commander'),
    express         = require('express'),
    session         = require('express-session'),
    morgan          = require('morgan'),
    passport        = require('passport'),
    OpenAmStrategy  = require('../..').Strategy;

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
    openAmBaseUrl: commander.base,
    enableLoginRedirect: true,
    enableUserProfile: true,
    logger: 'error'
  },
  function(token, profile, done) {
    return done(null, profile);
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

// Unprotected URL
app.get('/', function (req, res) {
  res.render('index', { user: req.user });
});

// Protected URL
app.get('/protected1', OpenAmStrategy.ensureAuthenticated, function (req, res) {
  res.json(req.user);
});

// Custom Protected Url
function customRouteMiddleware(req, res, next) {
  console.log('Authentication attempt logging.');
  passport.authenticate(OpenAmStrategy.strategyName)(req, res, next);
}

app.get('/protected2', customRouteMiddleware, function (req, res) {
  res.json(req.user);
});

var server = app.listen(commander.port, function () {
    console.info('Example application started on port %d.', server.address().port);
    console.info('Access protected resources at: http://localhost:%d/protected1 and http://localhost:%d/protected2', server.address().port, server.address().port);
});
