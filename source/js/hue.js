/* global Cookies */

$(() => {
  discoverBridges();
});

let connecting = false;

function discoverBridges() {
  let bridgeFound = false;
  $.get('https://www.meethue.com/api/nupnp', data => {
    for (let i in data) {
      let ip = data[i].internalipaddress;
      if (ip) {
        bridgeFound = true;
        $('#loading-bridges').hide();
        $('#bridges').append('<div class="selectGroup ' +
          'groupBridges" id="select-group-bridge-' + ip.replace(/\./g, '_') +
          '">' + ip + '</div>');
      } else {
        discoverBridgesError();
      }
    }

    $('.selectGroup.groupBridges').click(function() {
      $('.hueStep').hide();
      Cookies.remove('hueIp');
      Cookies.remove('hueUsername');
      Cookies.remove('hueName');
      Cookies.remove('hueRooms');
      $('.selectGroup.groupBridges.selected').each(function() {
        $(this).removeClass('selected');
      });
      $(this).addClass('selected');
      connecting = true;
      registerBridge(this.id.substring(this.id.lastIndexOf('-') + 1).replace(
        /_/g, '.'));
    });

    restoreState();
  }).fail(discoverBridgesError);
}

function discoverBridgesError() {
  $('#select-groups-loading-bridges').hide();
  $('#select-groups-bridges-error').show();
}

function registerBridge(ip) {
  let url = 'http://' + ip + '/api';
  let body = '{"devicetype": "descent#web_client"}';
  $.post(url, body, data => {
    $('#select-groups-loading-connect').show();
    $('#hue-step-button').show();
    if (data[0].error) {
      if (connecting) {
        setTimeout(registerBridge(ip), 5000);
      }
    } else {
      connecting = false;
      $('#select-groups-loading-connect').hide();
      $('#select-groups-loading-rooms').show();
      $('#hue-step-rooms').show();
      getBridge(ip, data[0].success.username);
    }
  });
}

function getBridge(ip, username) {
  let url = 'http://' + ip + '/api/' + username + '/config';
  $.get(url, data => {
    let name = data.name;
    $('.selectGroup.groupBridges.selected').html(name);

    Cookies.set('hueIp', ip, { expires: 3650 });
    Cookies.set('hueUsername', username, { expires: 3650 });
    Cookies.set('hueName', name, { expires: 3650 });
    getRooms(ip, username);
  });
}

function getRooms(ip, username) {
  let url = 'http://' + ip + '/api/' + username + '/groups';
  $.get(url, data => {
    $('.groupRooms').each(function() {
      $(this).remove();
    });
    $('#select-groups-loading-rooms').hide();
    for (let i in data) {
      let room = data[i];
      let name = room.name;
      $('#select-groups-rooms').append('<div class="selectGroup ' +
        'groupRooms" id="select-group-rooms-' + i + '">' + name + '</div>');
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
