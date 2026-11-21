// Page state shared across the now playing modules
export let resources = {
  features: {
    weather: false,
    hue: false
  },
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

let pageData = document.querySelector('.pageData');

export let user = pageData ? pageData.dataset.user : '';
export let lastfmKey = pageData ? pageData.dataset.lastfmKey : '';
