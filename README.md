# Last.fm Now

Simple now playing display for Last.fm showing song metadata and local weather.

## Usage

Run `npm install` to install the dependencies and `npm start` to start the
server. The server listens on port 3000 by default, but this can be changed
by setting the LFMN_PORT environment variable. It's recommended to use a proxy
such as NGINX in front of the server.

Navigate to [`/now`](https://wagnaria.xyz/now) to use the web app.

### Weather

Weather is powered by the [Dark Sky API](https://darksky.net/dev/), which
requires a personal API key if you're hosting the app yourself. You should set
this API key to the `DARK_SKY_KEY` environment variable. Note that Dark Sky
API used to be branded as Forecast API. This application previously accepted
the `FORECAST_KEY` environment variable, and will continue to do so, but
`DARK_SKY_KEY` will be given priority.

To enable weather display, you must allow the app to access your location. This
feature relies on HTML5 geolocation, so it will work in most modern browsers.

### Background Display

To hide the background image and keep a plain black background instead, append
`?nobg=true` to the URL.

### Phillips Hue Control

To enable Phillips Hue control, visit
[`/now/app/hue`](https://wagnaria.xyz/now/app/hue) and follow the setup
instructions. Light colors will be set according to the three most prominent
album art colors. If more than three lights are selected, the colors will be
reused.

## Overview

Fetches now playing song information from Last.fm and displays album artwork
along with local weather. Automatically hides the cursor after a few seconds
of inactivity if the window is in focus.

Able to control colored Philips Hue lights based on the prominent album art
colors.
