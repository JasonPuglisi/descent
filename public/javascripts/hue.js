$(function() {
  discoverBridges();
});

var connecting = false;

function discoverBridges() {
  var bridgeFound = false;
  $.get('https://www.meethue.com/api/nupnp', function(data) {
    for (var i in data) {
      var ip = data[i].internalipaddress;
      if (ip) {
        bridgeFound = true;
        $('#select-groups-loading-bridges').hide();
        $('#select-groups-bridges').append('<div class="select-group ' +
          'group-bridges" id="select-group-bridge-' + ip.replace(/\./g, '_') +
          '">' + ip + '</div>');
      } else {
        discoverBridgesError();
      }
    }

    $('.select-group.group-bridges').click(function() {
      $('.hue-step').hide();
      Cookies.remove('hueIp');
      Cookies.remove('hueUsername');
      Cookies.remove('hueName');
      Cookies.remove('hueRooms');
      $('.select-group.group-bridges.selected').each(function() {
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
  var url = 'http://' + ip + '/api';
  var body = '{"devicetype": "lastfm_now#web_client"}';
  $.post(url, body, function(data) {
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
  var url = 'http://' + ip + '/api/' + username + '/config';
  $.get(url, function(data) {
    var name = data.name;
    $('.select-group.group-bridges.selected').html(name);

    Cookies.set('hueIp', ip, { expires: 3650 });
    Cookies.set('hueUsername', username, { expires: 3650 });
    Cookies.set('hueName', name, { expires: 3650 });
    getRooms(ip, username);
  });
}

function getRooms(ip, username) {
  var url = 'http://' + ip + '/api/' + username + '/groups';
  $.get(url, function(data) {
    $('.group-rooms').each(function() {
      $(this).remove();
    });
    $('#select-groups-loading-rooms').hide();
    for (var i in data) {
      var room = data[i];
      var name = room.name;
      $('#select-groups-rooms').append('<div class="select-group ' +
        'group-rooms" id="select-group-rooms-' + i + '">' + name + '</div>');
    }

    restoreRooms();

    $('.group-rooms').click(function() {
      var e = $(this);
      if (!e.hasClass('selected')) {
        e.addClass('selected');
      } else {
        e.removeClass('selected');
      }

      var selectedRooms = [];
      $('.group-rooms.selected').each(function() {
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
  var ip = Cookies.get('hueIp');
  var username = Cookies.get('hueUsername');
  var name = Cookies.get('hueName');
  var rooms = Cookies.get('hueRooms');

  if (ip !== undefined && username !== undefined && name !== undefined) {
    $('#select-group-bridge-' + ip.replace(/\./g, '_')).html(name).addClass(
      'selected');
    $('#hue-step-button').show();
    $('#hue-step-rooms').show();

    getRooms(ip, username);
  }
}

function restoreRooms() {
  var rooms = Cookies.get('hueRooms');

  if (rooms !== undefined) {
    rooms = rooms.split(',');
    if (rooms.length > 0) {
      for (var i in rooms) {
        var room = rooms[i];
        $('#select-group-rooms-' + rooms[i]).addClass('selected');
      }
      $('#hue-step-done').show();
    }
  }
}
