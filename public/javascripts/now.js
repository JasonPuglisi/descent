$(() => {
  // Set globals
  window.resources = {
    images: {
      blank: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      cover: '',
      artist: ''
    },
    state: {
      cursorTimeout: 3,
      features: {
        weather: false,
        hue: false,
      },
      cover: new Image(),
      background: cookieExists('background') ? Cookies.get('background') : 'album'
    },
    track: {
      current: {
        artist: '',
        artistId: '',
        title: '',
        link: '',
        cover: ''
      },
      previous: {
        artist: '',
        title: ''
      }
    },
    colors: {
      regular: [],
      hue: [],
      hex: []
    }
  };

  // Initialize features
  init();
});

function init() {
  initCursor();
  initMenu();
  initMetadata();
  initWeather();
  initDatetime();
}
