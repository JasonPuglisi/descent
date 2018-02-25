function initMetadata() {
  // Update preview image properties
  $('#music #cover')[0].onload = fetchColors;

  // Start metadata fetch loop
  fetchMetadata();
  setInterval(fetchMetadata, 3000);
}

function fetchMetadata() {
  // Query Last.fm for recent track information
  let user = $('#music #user').text();
  let key = 'c1797de6bf0b7e401b623118120cd9e1';
  let url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${user}&api_key=${key}&limit=1&format=json`;
  $.get(url, data => {
    // Reset metadata if no recent tracks
    if (!data.recenttracks) {
      resetMetadata();
      return;
    }

    // Reset metadata if no track is playing
    let track = data.recenttracks.track[0];
    if (!track['@attr'] || !track['@attr'].nowplaying){
      resetMetadata();
      return;
    }

    // Update metadata
    let metadata = {
      artist: track.artist['#text'],
      artistId: track.artist.mbid,
      title: track.name,
      link: track.url,
      cover: track.image[track.image.length - 1]['#text']
    };

    setMetadata(metadata);
  }).fail(resetMetadata);
}

function setMetadata(metadata) {
  // Set track metadata
  resources.track.current.artist = metadata.artist;
  resources.track.current.artistId = metadata.artistId;
  resources.track.current.title = metadata.title;
  resources.track.current.link = metadata.link;
  resources.track.current.cover = metadata.cover ? metadata.cover : '';
  updateMetadata();
}

function resetMetadata() {
  // Clear/reset track metadata
  resources.track.current.artist = '';
  resources.track.current.artistId = '';
  resources.track.current.title = '';
  resources.track.current.link = '';
  resources.track.current.cover = '';
  updateMetadata();
}

function updateMetadata() {
  // Get current track metadata
  let artist = resources.track.current.artist;
  let title = resources.track.current.title;
  let link = resources.track.current.link;

  // Update track metadata text
  $('#music #artist').text(artist || 'Nothing in the air...');
  $('#music #title').text(title);
  $('#music #songLink').attr('href', link);

  // Update document title and show/hide extended info as necessary
  if (nowPlaying()) {
    document.title = `"${title}" by ${artist}`;
    if (cookieEnabled('extendedOn'))
      toggleDisplay('#userLine', true);
  } else {
    document.title = 'Last.fm Now';
    toggleDisplay('#userLine', false);
    resetBackground();
  }

  // Update cover and artist images
  fetchImages();
}
