# Descent

[![Build Status](https://travis-ci.com/JasonPuglisi/descent.svg?branch=master)](https://travis-ci.com/JasonPuglisi/descent)

Elegant now playing display for Last.fm showing song metadata and local weather.

## Usage

Ensure you have recent versions of [Node.js](https://nodejs.org/en/) and
[npm](https://www.npmjs.com/) installed. 

Run `npm i -g yarn` to install [yarn](https://yarnpkg.com/en/). Next, run
`yarn install` to install Decent's dependencies. Finally, run `yarn start` to
start Descent's server.

Descent's server listens on port 3000 by default, but this can be changed by
setting the `DESCENT_PORT` environment variable. It's recommended to use a
proxy, such as [NGINX](https://www.nginx.com/), in front of Descent's server.

Navigate to [`/now`](https://descent.live/now) to use Descent.

### Weather

Weather is powered by the [Dark Sky API](https://darksky.net/dev/), or the
[OpenWeatherMap API](https://openweathermap.org/api). To use either, you will
need to provide an API key. For Dark Sky, set your key as the `DARK_SKY_KEY`
environment variable. For OpenWeatherMap, set your key as the
`OPENWEATHERMAP_KEY` environment variable.

Dark Sky will take precedence, and OpenWeatherMap will be used if no Dark Sky
API key is provided, or if a Dark Sky API request fails. Dark Sky provides more
detailed weather summaries, but the officialy-hosted Descent uses
OpenWeatherMap to avoid fees.

For users to enable weather display, they must allow the Descent website to
access their location. This feature relies on HTML5 geolocation, so it may only
work in some modern browsers.

### Spotify Image Fallback

If Last.fm is unable to find an album or artist image, the
[Spotify Web API](https://beta.developer.spotify.com/documentation/web-api/)
may be used as a backup. You will need to provide API authorization through a
client ID and client secret assigned by Spotify. Set your client ID as the
`SPOTIFY_CLIENT` environment variable, and your client secret as the
`SPOTIFY_SECRET` environment variable.

### General User Configuration

To configure the background, weather, and time displays, visit
[`/now/app/config`](https://descent.live/now/app/config). Dark Sky can
automatically determine weather units, but OpenWeatherMap cannot, so Descent
defaults to imperial units unless otherwise specified.

### Phillips Hue Control User Configuration

To enable Phillips Hue control, visit
[`/now/app/hue`](https://descent.live/now/app/hue) and follow the setup
instructions. Light colors will be set according to the three most prominent
album art colors. If more than three lights are selected, the colors will be
reused.

If Descent is hosted using HTTPS, users must instruct their browsers to allow
loading insecure (HTTP) content for the Descent website. This is because the
Hue API can only be accessed via HTTP. Users are informed of this on the
configuration page.

## Overview

Fetches now playing song information from Last.fm and displays album artwork
along with local weather, time, and user info. Automatically hides the cursor
after a few seconds of inactivity if the window is in focus.

Able to control colored Philips Hue lights based on prominent album art colors.
