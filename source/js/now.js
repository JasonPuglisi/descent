/* global initCursor, initDatetime, initMenu, initMetadata, initWakeLock, initWeather*/

$(() => {
  // Set globals
  window.resources = {
    features: {
      weather: false,
      hue: false
    },
    cover: new Image(),
    cursorTimeout: 3,
    track: {
      current: {},
      previous: {}
    },
    colors: {
      regular: [],
      hex: [],
      hue: []
    }
  };

  // Initialize features
  init();
});

function init() {
  initWakeLock();
  initCursor();
  initMenu();
  initMetadata();
  initWeather();
  initDatetime();
}
