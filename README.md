# Last.fm Now

Simple now playing display for Last.fm showing song metadata and local weather.

## Usage

Run `npm install` to install the dependencies and `npm start` to start the
server. The server listens on port 3000 by default, but this can be changed
by setting the LFMN_PORT environment variable. It's recommended to use a proxy
such as NGINX in front of the server.

Navigate to [`/now`](https://wagnaria.xyz/now) to use the web app.

### Weather

Weather is powered by the [Dark Sky API](https://darksky.net/dev/), or the
[OpenWeatherMap API](https://openweathermap.org/api). For either, you will need
to provide an API key. For Dark Sky, set your key as the `DARK_SKY_KEY`
environment variable. For OpenWeatherMap, set your key as the
`OPENWEATHERMAP_KEY` environment variable.

Dark Sky will take precedence, and OpenWeatherMap will be used if no Dark Sky
API key is provided, or if a Dark Sky API request fails. Though the Dark Sky
API provides a slightly more elegant display, the officially-hosted version of
Last.fm Now uses the OpenWeatherMap API to keep it free.

To enable weather display, you must allow the app to access your location. This
feature relies on HTML5 geolocation, so it will work in most modern browsers.

### Configuration

To configure weather units or set the background type, visit
[`/now/app/config`](https://wagnaria.xyz/now/app/config). While Dark Sky can
automatically determine weather units, OpenWeatherMap cannot, so the app
defaults to imperial units unless otherwise manually specified.

### Phillips Hue Control

To enable Phillips Hue control, visit
[`/now/app/hue`](https://wagnaria.xyz/now/app/hue) and follow the setup
instructions. Light colors will be set according to the three most prominent
album art colors. If more than three lights are selected, the colors will be
reused.

Since the Hue API can only be accessed via HTTP, if you are hosting this web
app with HTTPS, users must instruct their web browsers to allow loading
insecure (HTTP) content for the domain. Users are informed of this on the Hue
settings page.

## Overview

Fetches now playing song information from Last.fm and displays album artwork
along with local weather. Automatically hides the cursor after a few seconds
of inactivity if the window is in focus.

Able to control colored Philips Hue lights based on the prominent album art
colors.
