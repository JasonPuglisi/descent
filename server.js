const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');

let app = express();
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/now/app/static/', express.static('public'));

app.get('/now', (req, res) => {
  let title = 'Descent';
  let users = [
    'iJason_',
    'jefferyd',
    'foreverautumn',
    'robinlisle',
    'ben-xo',
    'good_bone',
    'pellitero',
    'Nesquen',
    'hjbardenhagen',
    'Kvasmeister'
  ];
  let user = users[Math.floor(Math.random() * users.length)];

  res.render('index', { title, user });
});

app.post('/now', (req, res) => {
  let user = req.body.user || req.body.defaultUser;

  res.redirect(`/now/${user}`);
});

app.get('/now/:user', (req, res) => {
  let title = 'Descent';
  let user = req.params.user.substring(0, 20);

  res.render('now', { title, user });
});

app.get('/now/app/config', (req, res) => {
  let title = 'Descent Configuration';

  res.render('config', { title });
});

app.get('/now/app/hue', (req, res) => {
  let title = 'Descent Hue Setup';

  res.render('hue', { title });
});

app.get('/now/app/cover', (req, res) => {
  let url = req.query.url;
  if (!url) {
    console.log('Error getting cover: No URL specified');
    res.send();
  }

  let pattern = /^https\:\/\/lastfm-img[0-9]+\.akamaized\.net\//;
  if (!url.match(pattern)) {
      console.log(`Error getting cover: Invalid URL - ${url}`);
      res.send();
  }

  request({ url, encoding: null }, (err, res2, body) => {
    if (err || res2.statusCode != 200) {
      console.log(`Error getting cover: Invalid response - ${err}`);
      res.send();
    }

    res.send(body);
  });
});

app.post('/now/app/weather', (req, res) => {
  let lat = req.body.latitude;
  let lon = req.body.longitude;
  let units = req.body.units;

  let dsKey = process.env.DARK_SKY_KEY;
  let owmKey = process.env.OPENWEATHERMAP_KEY;

  if (dsKey)
    getWeatherDarkSky(dsKey, lat, lon, units, (err, weather) => {
      if (err)
        console.log(`Error getting Dark Sky weather: ${err}`);

      res.json(weather);
    });
  else if (owmKey)
    getWeatherOpenweathermap(owmKey, lat, lon, units, (err, weather) => {
      if (err)
        console.log(`Error getting OpenWeatherMap weather: ${err}`);

      res.json(weather);
    });
  else {
    console.log('Error getting weather: No API key');
    res.json(new Weather());
  }
});

app.listen(process.env.DESCENT_PORT || 3000);

class Weather {
  constructor(success) {
    this.success = success === true;
  }
}

function getWeatherDarkSky(key, lat, lon, units, callback) {
  units = units === 'imperial' ? 'us' : 'si';
  let url = `https://api.darksky.net/forecast/${key}/${lat},${lon}?units=${units}`;

  request(url, (err, res, body) => {
    if (err || res.statusCode != 200)
      callback(`Invalid response: ${err}`, new Weather());

    let data = JSON.parse(body);
    let icons = {
      'clear-day': 'day-sunny',
      'clear-night': 'night-clear',
      'rain': 'rain',
      'snow': 'snow',
      'sleet': 'sleet',
      'wind': 'cloudy-gusts',
      'fog': 'fog',
      'cloudy': 'cloudy',
      'partly-cloudy-day': 'day-cloudy',
      'partly-cloudy-night': 'night-alt-cloudy',
      'hail': 'hail',
      'thunderstorm': 'thunderstorm',
      'tornado': 'tornado'
    };

    let weather = new Weather(true);
    weather.summary = data.minutely.summary;
    weather.temperature = Math.round(data.currently.temperature);
    weather.apparentTemperature = Math.round(data.currently.apparentTemperature);
    weather.unit = units === 'us' ? 'F' : 'C';
    weather.icon = icons[data.currently.icon];

    callback(null, weather);
  });
}

function getWeatherOpenweathermap(key, lat, lon, units, callback) {
  var url = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`;

  request(url, (err, res, body) => {
    if (err || res.statusCode != 200)
      callback(`Invalid response: ${err}`, new Weather());

    let data = JSON.parse(body);
    let icons = {
      '01d': 'day-sunny',
      '01n': 'night-clear',
      '02d': 'day-cloudy',
      '02n': 'night-cloudy',
      '03d': 'cloud',
      '03n': 'cloud',
      '04d': 'cloudy',
      '04n': 'cloudy',
      '09d': 'rain',
      '09n': 'rain',
      '10d': 'day-rain',
      '10n': 'night-rain',
      '11d': 'thunderstorm',
      '11n': 'thunderstorm',
      '13d': 'snow',
      '13n': 'snow',
      '50d': 'windy',
      '50n': 'windy'
    };
    let apparent;
    if (units === 'imperial')
      apparent = 35.74 + 0.6215 * data.main.temp - 35.75 * Math.pow(data.wind.speed, 0.16)
        + 0.4275 * data.main.temp * Math.pow(data.wind.speed, 0.16);
    else
      apparent = 13.12 + 0.6215 * data.main.temp - 11.37 * Math.pow(data.wind.speed, 0.16)
        + 0.3965 * data.main.temp * Math.pow(data.wind.speed, 0.16);

    let weather = new Weather(true);
    weather.summary = `${data.weather[0].description} currently`;
    weather.summary = `${weather.summary.substring(0, 1).toUpperCase()}${weather.summary.substring(1)}`;
    weather.temperature = Math.round(data.main.temp);
    weather.apparentTemperature = Math.round(apparent);
    weather.unit = units === 'imperial' ? 'F' : 'C';
    weather.icon = `wi wi-${icons[data.weather[0].icon]}`;

    callback(null, weather);
  });
}
