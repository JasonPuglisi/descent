var bodyParser = require('body-parser');
var express = require('express');
var request = require('request');

var app = express();

var defaultUsernames = ['iJason_', 'jefferyd', 'foreverautumn', 'robinlisle',
  'ben-xo', 'good_bone', 'pellitero', 'Nesquen', 'hjbardenhagen'];

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/now/static/', express.static('public'));

app.get('/now', function(req, res) {
  var usernameIndex = Math.floor(Math.random() * defaultUsernames.length);
  var username = defaultUsernames[usernameIndex];

  res.render('index', { title: 'Last.fm Now', username: username });
});

app.post('/now', function(req, res) {
  var username = req.body.username || req.body.defaultUsername;

  if (username.length > 20) {
    username = username.substring(0, 20);
  }
  res.redirect('/now/' + username);
});

app.get('/now/:user', function(req, res) {
  res.render('now', { title: 'Last.fm Now', user: req.params.user });
});

app.get('/now/:user/cover', function(req, res) {
  if (req.query.url) {
    request({ url: req.query.url, encoding: null },
        function (err, res2, body) {
      if (!err && res2.statusCode == 200) {
        res.send(body);
      } else {
        console.log('Error getting cover: ', err);
        res.send();
      }
    });
  } else {
    console.log('Error getting cover: No url specified');
    res.send();
  }
});

app.post('/now/hue/info', function(req, res) {
  var accessToken = req.body.accessToken;
  var bridgeId = req.body.bridgeId;

  var url = 'https://www.meethue.com/api/getbridge?token=' + accessToken +
    '&bridgeid=' + bridgeId;
  request(url, function(err, res2, body) {
    if (!err && res2.statusCode == 200) {
      res.json(JSON.parse(body));
    } else {
      console.log('Error getting Hue: ', err);
      res.send();
    }
  });
});

app.post('/now/hue/set', function(req, res) {
  var url = parseUrl(req.body.url);
  var body = { form: { clipmessage: req.body.clipmessage } };
  request.post(url, body, function(err, res2, body) {
    if (!err && res2.statusCode == 200) {
      res.json(JSON.parse(body));
    } else {
      console.log('Error setting Hue: ', err);
      res.send();
    }
  });
});

app.post('/now/weather', function(req, res) {
  var key = process.env.FORECAST_KEY;
  var url = 'https://api.forecast.io/forecast/' + key + '/' +
    req.body.latitude + ',' + req.body.longitude + '?units=auto';

  request(url, function(err, res2, body) {
    if (!err && res2.statusCode == 200) {
      res.json(JSON.parse(body));
    } else {
      console.log('Error getting Forecast: ', err);
      res.send();
    }
  });
});

app.listen(process.env.LFMN_PORT || 3000);

function parseUrl(url) {
  return url.substring(1, url.length - 1);
}

