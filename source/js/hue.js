/* global Cookies */
/* global cookieEnabled */

$(() => {
  loadAuthorization();
  processOptions();
});

function loadAuthorization() {
  let accessToken = Cookies.get('hueAccessToken');
  let refreshToken = Cookies.get('hueRefreshToken');
  let username = Cookies.get('hueUsername');
  if (accessToken) {
    $('#loading').hide();
    $('#hue-step-rooms').show();
    $('#hue-options').show();
    getRooms(accessToken, username);
  } else if (refreshToken) {
    refreshAccessToken(refreshToken, username, loadAuthorization);
  } else {
    $('#loading').hide();
    $('#connect').show();
    authorizeApplication();
  }
}

function refreshAccessToken(refreshToken, username, callback) {
  let url = `/app/hue/authorize?refreshToken=${refreshToken}&username=${username}`;
  $.get(url, () => {
    callback();
  });
}

function authorizeApplication() {
  let hueClientId = encodeURIComponent($('.hueClientId').text());
  $('.appAuth').attr('href', `https://api.meethue.com/v2/oauth2/authorize?client_id=${hueClientId}&response_type=code`);
}

function getRooms(accessToken, username) {
  let url = '/app/hue/api/groups';
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
        Cookies.set('hueRooms', selectedRooms.join(','), { expires: 3650, secure: true });
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
    $('#hue-options').show();

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

function processOptions() {
  let options = ['shuffle'];
  options.forEach(option => {
    let selected = cookieEnabled(option);
    $(`#hue-${option}`).toggleClass('selected', selected);

    $(`#hue-${option}`).on('click', function() {
      selected = !selected;
      $(this).toggleClass('selected');
      Cookies.set(option, selected, { expires: 3650, secure: true });
    });
  });
}
