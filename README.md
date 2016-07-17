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

To enable Phillips Hue control, follow the instructions below. Light colors
will be set according to the three most prominent album art colors. If more
than three lights are detected, the colors will be reused.

1. Visit https://www.meethue.com/api/nupnp on the network that your bridge is
   connected to. Note the bridge ID.

2. Visit `www.meethue.com/en-US/api/gettoken?devicename=lastfm_now&appid=hueapp&deviceid=<BRIDGE_ID>`
   where `<BRIDGE_ID>` is the identifier you located in the previous step.

3. Log in with your Phillips Hue account and authorize the application.

4. Upon redirection, note the last part of the URL in your browser (after
   `/login/`). This is the access token.

5. On one of Last.fm Now's pages, open the JavaScript console in your web
   browser and issue the following command to set your bridge ID:
   `Cookies.set('hueBridgeId', '<BRIDGE_ID>', { expires: 3650 })`

6. Similar to the previous step, issue the following command to set your access
   token: `Cookies.set('hueAccessToken', '<ACCESS_TOKEN>', { expires: 3650 })`

7. Refresh the page, and use the `l` key to turn Phillips Hue control on.
   Phillips Hue control status will be indicated in the help menu, which is
   accessed using the `h` key. You can use the `l` key again to turn control
   off.

The app should now be able to control your Phillips Hue lights from any
network. By default, these settings will persist for 3650 days. To change this,
replace `3560` in the commands of steps 5 and 6 with the desired number of
days.

