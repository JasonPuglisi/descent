/* global initCursor, initDatetime, initMenu, initMetadata, initWeather*/

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
  initCursor();
  initMenu();
  initMetadata();
  initWeather();
  initDatetime();
}
