# Last.fm Now

Last.fm is a now playing display for Last.fm. It was inspiried by the old
`last.fm/user/<user>/now` pages that no longer exist. It shows cover art, track
title, track artist, and weather. Because it can. It can also control Hue
lights in a really hacky way. Because it can.

# User Pages

To see what a user is listening to, navigate to `/now/<username>`. A fully
functional version of this code is hosted at `https://wagnaria.xyz/now`. An
example URL, for my page, is:

[wagnaria.xyz/now/ijason\_](https://wagnaria.xyz/now/ijason_)

# Weather

Weather is powered by [Forecast API](https://developer.forecast.io/). It is
rate-limited, so you'll need your own API key from there. You get 1,000 free
calls a day, signing up for an account is really the only trouble. Set this
key as your `FORECAST_KEY` environment variable, so Last.fm Now can read it
automatically.

To enable weather display, simply allow the website to use your location. If
your web browser lacks HTML5 geolocation features, it won't work. Sorry. If
your web browser has HTML5 geolocation features, it still may not work. Sorry.
Blame HTML. It's not my fault, I swear.

# Phillips Hue Control

This is pretty hacky and I really don't feel like writing up instructions on
how to do it (because I don't even remember myself), but I'm going to do it
anyway. I found these instructions on some website a while ago, but I think
I found a different website writing them this time. It's this one:
https://docs.apitools.com/blog/2015/02/25/hacking-apitools-during-the-3scale-internal-hackathon.html

1. Get your bridge ID. Visit `https://www.meethue.com/api/nupnp` on your
   bridge's local network, which should give you what you need. The IP address
   doesn't matter.

2. Visit `www.meethue.com/en-US/api/gettoken?devicename=lastfm_now&appid=hueapp&deviceid=<BRIDGE_ID>`.
   Of course, replace `<BRIDGE_ID>` with the ID you found above. Login with
   your Hue account and authorize the "app".

3. This should redirect you to a URL that doesn't work. Copy the last part of
   that URL (after `/login/`). This is your authorization key. Hold onto it!

4. So now we have a bridge ID and an authorization key. We're ready to make
   magic happen! I was too lazy to create an interface, so we need to set some
   cookies to let Last.fm Now control your Hue lights. Luckily, the now playing
   page includes a cookie library for convenience. You'll have to open up the
   JavaScript console in your browser for the next few steps.

5. Set your bridge ID with
   `Cookie.set('hueBridgeId', '<BRIDGE_ID>', { expires: 1000 })`. I set the
   cookie expiration to 1000 days, but you can change it.

6. Set your authorization key with
   `Cookie.set('hueAuthorizationKey', '<AUTH_KEY>', { expires: 1000})`.

7. Finally, set tell the app you're ready to get your Hue on by running
   `Cookie.set('hueEnabled', 'true', { expires: 1000 })`. Woo, we're done!

8. You should now notice your lights changing according to the album art
   colors, just like the music metadata text does. That is of course unless I
   hammer this poor guy's color analysis servers to a point where they stop
   responding. Or if he gets tired of my shit. Either way.

By default, the most prominent three colors of the album art will be fetched.
The first two are used for the title and artist text, respectively, and all
three are used for lights. That's assuming you have at least three lights. If
you have more, those three colors will be repeated.

