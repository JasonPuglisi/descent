/* global Cookies */

$(() => {
  loadAuthorization();
});

function loadAuthorization() {
  let accessToken = Cookies.get('hueAccessToken');
  let refreshToken = Cookies.get('hueRefreshToken');
  let username = Cookies.get('hueUsername');
  if (accessToken) {
    $('#loading').hide();
    $('#hue-step-rooms').show();
    getRooms(accessToken, username);
  } else if (refreshToken) {
    refreshAccessToken(refreshToken, loadAuthorization);
  } else {
    $('#loading').hide();
    $('#connect').show();
    authorizeApplication();
  }
}

function refreshAccessToken(refreshToken, callback) {
  let url = `/now/app/hue/authorize?refreshToken=${refreshToken}`;
  $.get(url, () => {
    callback();
  });
}

function authorizeApplication() {
  let hueClientId = $('.hueClientId').text();
  let hueAppId = $('.hueAppId').text();
  $('.appAuth').attr('href', `https://api.meethue.com/oauth2/auth?clientid=${hueClientId}&appid=${hueAppId}&deviceid=Descent&response_type=code`);
}

function getRooms(accessToken, username) {
  let url = '/now/app/hue/api/groups';
  $.post(url, { accessToken, username }, data => {
    $('.groupRooms').each(function() {
      $(this).remove();
    });
    $('#select-groups-loading-rooms').hide();
    for (let i in data) {
      let room = data[i];
      if (room.type === 'Room') {
        let name = room.name;
        $('#select-groups-rooms').append('<div class="selectGroup ' +
          'groupRooms" id="select-group-rooms-' + i + '">' + name + '</div>');
      }
    }

    restoreRooms();

    $('.groupRooms').click(function() {
      let e = $(this);
      if (!e.hasClass('selected')) {
        e.addClass('selected');
      } else {
        e.removeClass('selected');
      }

      let selectedRooms = [];
      $('.groupRooms.selected').each(function() {
        selectedRooms.push(this.id.substring('select-group-rooms-'.length));
      });

      if (selectedRooms.length > 0) {
        $('#hue-step-done').show();
        Cookies.set('hueRooms', selectedRooms.join(','), { expires: 3650 });
      } else {
        $('#hue-step-done').hide();
        Cookies.remove('hueRooms');
        Cookies.remove('hueEnabled');
      }
    });
  });
}

function restoreState() {
  let ip = Cookies.get('hueIp');
  let username = Cookies.get('hueUsername');
  let name = Cookies.get('hueName');
  let rooms = Cookies.get('hueRooms');

  if (ip !== undefined && username !== undefined && name !== undefined) {
    $('#select-group-bridge-' + ip.replace(/\./g, '_')).html(name).addClass(
      'selected');
    $('#hue-step-button').show();
    $('#hue-step-rooms').show();

    getRooms(ip, username);
  }
}

function restoreRooms() {
  let rooms = Cookies.get('hueRooms');

  if (rooms !== undefined) {
    rooms = rooms.split(',');
    if (rooms.length > 0) {
      for (let i in rooms) {
        let room = rooms[i];
        $('#select-group-rooms-' + rooms[i]).addClass('selected');
      }
      $('#hue-step-done').show();
    }
  }
}
