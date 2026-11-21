import { initCursor, initWakeLock } from './utility/general.js';
import { initMenu } from './utility/menu.js';
import { initMetadata } from './utility/metadata.js';
import { initDatetime } from './utility/time.js';
import { initWeather } from './utility/weather.js';

// Modules run once the document is parsed, so there's no ready event to wait on
initWakeLock();
initCursor();
initMenu();
initMetadata();
initWeather();
initDatetime();
