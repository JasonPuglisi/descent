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

app.get('/now/app/cover', function(req, res) {
  if (req.query.url) {
    var regex = /^https\:\/\/lastfm-img[0-9]+\.akamaized\.net\//;
    var matched = req.query.url.match(regex);
    if (matched) {
      request({ url: req.query.url, encoding: null },
          function(err, res2, body) {
        if (!err && res2.statusCode == 200) {
          res.send(body);
        } else {
          console.log('Error getting cover: ', err);
          res.send();
        }
      });
    } else {
      console.log('Error getting cover: Invalid URL ' + req.query.url);
      res.send();
    }
  } else {
    console.log('Error getting cover: No URL specified');
    res.send();
  }
});

app.post('/now/app/weather', function(req, res) {
  getForecastDarkSky(req.body.latitude, req.body.longitude, req.body.units,
    function(err, data) {
    if (!err) {
      res.json(data);
      res.send();
    } else {
      if (err !== 'No API key') {
        console.log('Error getting DarkSky forecast: ', err);
      }
      getForecastOpenweathermap(req.body.latitude, req.body.longitude,
        req.body.units, function(err, data) {
        if (!err) {
          res.json(data);
          res.send();
        } else {
          console.log('Error getting OpenWeatherMap forecast: ', err);
          res.send();
        }
      });
    }
  });
});

app.get('/now/app/config', function(req, res) {
  res.render('config', { title: 'Last.fm Now Configuration' });
});

app.get('/now/app/hue', function(req, res) {
  res.render('hue', { title: 'Last.fm Now Hue Setup' });
});

app.post('/now/app/hue/info', function(req, res) {
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

app.post('/now/app/hue/set', function(req, res) {
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

app.get('/now/:user', function(req, res) {
  res.render('now', { title: 'Last.fm Now', user: req.params.user,
    nobg: req.query.nobg === 'true' });
});

app.listen(process.env.LFMN_PORT || 3000);

function parseUrl(url) {
  return url.substring(1, url.length - 1);
}

function getForecastDarkSky(latitude, longitude, units, callback) {
  var key = process.env.DARK_SKY_KEY;
  if (key) {
    units = units == 'imperial' ? 'us' : 'si';
    var url = 'https://api.darksky.net/forecast/' + key + '/' + latitude +
      ',' + longitude + '?units=' + units;

    request(url, function(err, res, body) {
      if (!err && res.statusCode == 200) {
        var data = JSON.parse(body);
        data.apiType = 'darkSky';
        callback(null, data);
      } else {
        callback('Invalid response: ' + err);
      }
    });
  } else {
    callback('No API key');
  }
}

function getForecastOpenweathermap(latitude, longitude, units, callback) {
  var key = process.env.OPENWEATHERMAP_KEY;
  if (key) {
    var url = 'http://api.openweathermap.org/data/2.5/weather?lat=' +
      latitude + '&lon=' + longitude + '&units=' + units + '&appid=' + key;

    request(url, function(err, res, body) {
      if (!err && res.statusCode == 200) {
        var data = JSON.parse(body);
        data.apiType = 'openweathermap';
        callback(null, data);
      } else {
        callback('Invalid response: ' + err);
      }
    });
  } else {
    callback('No API key');
  }
}
