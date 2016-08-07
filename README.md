# Last.fm Now

Last.fm Now is a simple now playing display for Last.fm. It shows song metadata
in addition to local weather.

The app can also change Phillips Hue light colors to match the album art of the
current song.

## Usage

Last.fm Now can be run on any server, and it listens on port 3000 by default.
You can change the listening port by setting it to the LFMN\_PORT environment
variable. You should use a proper web server such as NGINX to forward outside
traffic to the app. The app operates completely under the `/now` location.

The app is hosted officially at [wagnaria.xyz/now](https://wagnaria.xyz/now).

## Weather

Weather is powered by the [Forecast API](https://developer.forecast.io/),
which requires a personal API key if you're hosting the app yourself. You
should set this API key to the `FORECAST_KEY` environment variable.

To enable weather display, you must allow the app to access your location. This
feature relies on HTML5 geolocation, so it will work in most modern browsers.

Note that the HTML5 geolocation API may be unresponsive at times, and there is
currently no way to ensure 100% reliability.

## Background Display

To hide the background image and keep a plain black background instead, append
`?nobg=true` to the URL.

## Phillips Hue Control

To enable Phillips Hue control, append `/hue` to the URL and follow setup
instructions. Light colors will be set according to the three most prominent
album art colors. If more than three lights are detected, the colors will be
reused.

