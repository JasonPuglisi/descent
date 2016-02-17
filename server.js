var bodyParser = require('body-parser');
var express = require('express');
var request = require('request');

var app = express();

app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/now/static/', express.static('public'));

app.get('/now', function(req, res) {
  res.render('index', { title: 'Last.fm Now' });
});

app.post('/now', function(req, res) {
  var username = req.body.username;
  if (username) {
    res.redirect('/now/' + username);
  } else {
    res.redirect('/now');
  }
});

app.get('/now/:user', function(req, res) {
  res.render('now', { title: 'Now Playing', user: req.params.user });
});

app.post('/now/colors', function(req, res) {
  var image = parseUrl(req.body.image);
  if (image) {
    var clusters = req.body.clusters;

    var url = 'http://mkweb.bcgsc.ca/color-summarizer/?url=' + image +
      '&num_clusters=' + clusters + '&json=1';
    request(url, function(err, res2, body) {
      if (!err && res2.statusCode == 200) {
        res.json(JSON.parse(body));
      } else {
        console.log(err);
      }
    });
  } else {
    res.json({});
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
      console.log(err);
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
      console.log(err);
    }
  });
});

app.post('/now/weather', function(req, res) {
  var key = process.env.FORECAST_KEY;
  console.log(key);
  var url = 'https://api.forecast.io/forecast/' + key + '/' +
    req.body.latitude + ',' + req.body.longitude + '?units=auto';

  request(url, function(err, res2, body) {
    if (!err && res2.statusCode == 200) {
      res.json(JSON.parse(body));
    } else {
      console.log(err);
    }
  });
});

app.listen(3000);

function parseUrl(url) {
  return url.substring(1, url.length - 1);
}

