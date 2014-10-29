var bodyParser      = require('body-parser'),
    cookieParser    = require('cookie-parser'),
    express         = require('express'),
    session         = require('express-session'),
    morgan          = require('morgan'),
    passport        = require('passport'),
    OpenAmStrategy  = require('../..').Strategy;

// Passport session setup.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Create OpenAM Passport stategy
passport.use(new OpenAmStrategy({
    openAmBaseUrl: 'http://localhost:8080/OpenAM-11.0.0/',
    enableLoginRedirect: true,
    enableUserProfile: true
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

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else {
    passport.authenticate('openam')(req, res, next);
  }
}

// Protected URL
app.get('/account', OpenAmStrategy.ensureAuthenticated, function (req, res) {
  res.json(req.user);
});

var server = app.listen(3000, function () {
    console.info('Example application started on port %d.', server.address().port);
});
