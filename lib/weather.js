// OpenWeatherMap lookups, cached per place and unit. Every open display asks
// every five minutes, conditions change slower than that, and the free plan
// caps calls per day, so displays near each other share one answer for a while.
//
// Coordinates are rounded to two decimal places, about a kilometer, before
// they become the cache key. That's finer than OpenWeatherMap's own grid, and
// it keeps a browser's ever-shifting GPS fix from missing the cache each time.

let endpoint = 'https://api.openweathermap.org/data/2.5/weather';

let icons = {
  '01d': 'day-sunny',
  '01n': 'night-clear',
  '02d': 'day-cloudy',
  '02n': 'night-cloudy',
  '03d': 'cloud',
  '03n': 'cloud',
  '04d': 'cloudy',
  '04n': 'cloudy',
  '09d': 'rain',
  '09n': 'rain',
  '10d': 'day-rain',
  '10n': 'night-rain',
  '11d': 'thunderstorm',
  '11n': 'thunderstorm',
  '13d': 'snow',
  '13n': 'snow',
  '50d': 'windy',
  '50n': 'windy'
};

let units = ['imperial', 'metric'];

export function createWeather({ key, ttl = 10 * 60 * 1000, timeout = 4000, fetch = globalThis.fetch, now = Date.now }) {
  let cache = new Map();
  let inFlight = new Map();

  // Old entries are only useful until they expire, so sweep them out whenever
  // a new one goes in rather than letting the map grow with every place seen
  function store(place, weather) {
    let time = now();

    for (let [cached, entry] of cache)
      if (time - entry.fetched >= ttl)
        cache.delete(cached);

    cache.set(place, { weather, fetched: time });
  }

  async function lookup(place, latitude, longitude, unit) {
    let query = new URLSearchParams({ 'lat': latitude, 'lon': longitude, 'units': unit, 'appid': key });
    let data;

    try {
      let response = await fetch(`${endpoint}?${query}`, { 'signal': AbortSignal.timeout(timeout) });

      if (!response.ok) {
        console.warn(`Error getting OpenWeatherMap weather: ${response.status}`);
        return { success: false };
      }

      data = await response.json();
    } catch (e) {
      console.warn(`Error getting OpenWeatherMap weather: ${e.name}`);
      return { success: false };
    }

    let weather = formatWeather(data, unit);

    // Failures aren't kept, so the next poll tries again
    if (weather.success)
      store(place, weather);

    return weather;
  }

  // Resolves to what the page shows, with success false when there's nothing
  // to show
  function get(latitude, longitude, unit) {
    let place = placeKey(latitude, longitude, unit);

    if (!key || !place)
      return Promise.resolve({ success: false });

    let cached = cache.get(place);

    if (cached && now() - cached.fetched < ttl)
      return Promise.resolve(cached.weather);

    if (inFlight.has(place))
      return inFlight.get(place);

    let [lat, lon, u] = place.split(',');
    let request = lookup(place, lat, lon, u).finally(() => inFlight.delete(place));
    inFlight.set(place, request);

    return request;
  }

  return { get, size: () => cache.size };
}

// Undefined when the coordinates or unit aren't something to look up, so
// nonsense never reaches OpenWeatherMap
export function placeKey(latitude, longitude, unit) {
  let lat = parseFloat(latitude);
  let lon = parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return undefined;

  if (!units.includes(unit))
    return undefined;

  return `${lat.toFixed(2)},${lon.toFixed(2)},${unit}`;
}

// OpenWeatherMap works out its own feels like temperature. The page used to
// compute wind chill instead, which only holds in the cold and read several
// degrees low on any warm day with a breeze.
export function formatWeather(data, unit) {
  let condition = data?.weather?.[0];
  let main = data?.main;

  if (!condition || !main || !Number.isFinite(main.temp))
    return { success: false };

  let summary = `${condition.description} currently`;

  return {
    success: true,
    summary: `${summary.substring(0, 1).toUpperCase()}${summary.substring(1)}`,
    temperature: Math.round(main.temp),
    apparentTemperature: Math.round(Number.isFinite(main.feels_like) ? main.feels_like : main.temp),
    unit: unit === 'imperial' ? 'F' : 'C',
    icon: `wi wi-${icons[condition.icon] || 'na'}`
  };
}
