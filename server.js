var bodyParser = require('body-parser');
var express = require('express');
var fs = require('fs');
var getImageColors = require('get-image-colors');
var request = require('request');
var temp = require('temp').track();

var app = express();

var defaultUsernames = ['iJason_', 'jefferyd', 'foreverautumn', 'robinlisle',
  'ben-xo', 'good_bone', 'pellitero', 'Nesquen', 'hjbardenhagen'];

app.set('view engine', 'jade');
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

app.post('/now/colors', function(req, res) {
  var image = parseUrl(req.body.image);
  if (image) {
    request({ url: image, encoding: null }, function(err, res2, body) {
      if (!err && res2.statusCode == 200) {
        var data = body;

        temp.open({ prefix: 'lfmn-', suffix: '.png' }, function(err, info) {
          if (!err) {
            fs.writeFile(info.fd, data, function(err) {
              if (!err) {
                fs.close(info.fd, function(err) {
                  if (!err) {
                    getImageColors(info.path, function(err, colors) {
                      if (!err) {
                        handleColors(colors, function(colors) {
                          res.json(colors);
                        });
                      } else {
                        res.json({});
                      }
                    });
                  } else {
                    console.log(err);
                    res.json({});
                  }
                });
              } else {
                console.log(err);
                res.json({});
              }
            });
          } else {
            console.log(err);
            res.json({});
          }
        });
      } else {
        console.log(err);
        res.json({});
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

function handleColors(colors, callback) {
  var newColors = [];

  for (var i = 0; i < colors.length; i++) {
    var color = colors[i];
    var hex = color.brighten(2).hex();
    color = color.gl();

    for (var j = 0; j < color.length; j++) {
      color[j] = color[j] > 0.04045 ?
        Math.pow((color[j] + 0.055) / 1.055, 2.4) : color[j] / 12.92;
    }

    var x = color[0] * 0.664511 + color[1] * 0.154324 + color[2] * 0.162028;
    var y = color[0] * 0.283881 + color[1] * 0.668433 + color[2] * 0.047685;
    var z = color[0] * 0.000088 + color[1] * 0.072310 + color[2] * 0.986039;

    var finalX = x / (x + y + z);
    var finalY = y / (x + y + z);

    newColors.push({ hex: hex, xy: [ finalX, finalY ] });
  }

  callback(newColors);
}

