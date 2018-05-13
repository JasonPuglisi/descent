/* global resources, Cookies */
/* global cookieEnabled, cookieExists, toggleDisplay */

// Initialize weather display
function initWeather() {
  // Ensure HTML5 geolocation API is present and get coordinates
  if (navigator.geolocation)
    navigator.geolocation.getCurrentPosition(position => {
      let coords = position.coords;

      // Update weather display immediately
      updateWeather(coords);

      // Update weather display at regular intervals
      let minutes = 5; // Refresh rate in minutes
      setInterval(() => { updateWeather(coords); }, minutes * 60000);
    });
}

// Update weather display
function updateWeather(coords) {
  let url = '/now/app/weather';
  let units = cookieExists('units') ? Cookies.get('units') : 'imperial';
  let urlUnits = encodeURIComponent(units);
  let body = `latitude=${coords.latitude}&longitude=${coords.longitude}&units=${urlUnits}`;

  $.post(url, body, data => {
    // Perform no action if unsuccessful
    if (!data.success)
      return;

    // Enable weather display
    resources.features.weather = true;

    // Update weather data
    $('.weather .summary').text(data.summary);
    $('.weather .conditions .temperature').text(data.temperature);
    $('.weather .conditions .apparentTemperature').text(data.apparentTemperature);
    $('.weather .conditions .unit').text(data.unit);
    $('.weather .conditions .icon').removeClass($(this).attr('class')).addClass(data.icon);

    // Display weather text as appropriate
    if (cookieEnabled('weatherOn') || !cookieExists('weatherOn'))
      toggleDisplay('.weather', true);
  });
}
