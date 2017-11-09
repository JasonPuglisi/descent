$(function() {
  window.lastUrl = '';

  $('.hue-bridge-id').on('paste focusout', function() {
    resetHue();

    setTimeout(processHueBridgeId, 10);
  });

  if (Cookies.get('hueBridgeId') && Cookies.get('hueAccessToken')) {
    $('.hue-step-two, .hue-step-three').show();

    getHueGroups();
  }

  if (Cookies.get('hueGroups')) {
    $('.hue-step-five').show();
  }
});

function processHueBridgeId() {
  var id = $('.hue-bridge-id').val();

  if (id) {
    Cookies.set('hueBridgeId', id, { expires: 3650 });

    $('.hue-token-link').attr('href', 'http://www.meethue.com/en-US/api/' +
      'gettoken?devicename=lastfm_now&appid=hueapp&deviceid=' + id);
    $('.hue-token-link').click(processHueTokenLinkClick);

    $('.hue-step-two').show();
  }
}

function processHueTokenLinkClick() {
  $('.hue-step-three').show();

  $('.hue-token').on('paste focusout', function() {
    setTimeout(function() {
      if (lastUrl != $('.hue-token').val()) {
        resetHueGroups();

        lastUrl = $('.hue-token').val();
        processHueToken();
      }
    }, 10);
  });
}

function processHueToken() {
  var token = $('.hue-token').val();

  if (token) {
    if (token.indexOf('phhueapp://') !== 0) {
      $('.hue-token-error').show();
    } else {
      $('.hue-token-error').hide();

      token = token.substring(token.lastIndexOf('/') + 1);

      Cookies.set('hueAccessToken', token, { expires: 3650 });

      getHueGroups();
    }
  }
}

function getHueGroups() {
  $('.hue-step-four').show();

  var url = '/now/app/hue/info';
  var body = 'accessToken=' + Cookies.get('hueAccessToken') + '&bridgeId=' +
    Cookies.get('hueBridgeId');
  $.post(url, body, function(data) {
    $('.select-groups-loading').hide();

    var groups = data.groups;
    var selectedGroups = (Cookies.get('hueGroups') || '').split(',');
    for (var i in groups) {
      var name = groups[i].name;
      var className = 'select-group';
      if (selectedGroups.indexOf(i) != -1) {
        className += ' selected';
      }
      $('.select-groups').append('<div class="' + className + '" id="select-group-' +
        i + '">' + name + '</div>');
    }

    $('.select-group').on('click', function() {
      var e = $(this);
      if (!e.hasClass('selected')) {
        e.addClass('selected');
      } else {
        e.removeClass('selected');
      }

      var selectedGroups = [];
      $('.select-group.selected').each(function() {
        selectedGroups.push(this.id.substring('select-group-'.length));
      });

      if (selectedGroups.length > 0) {
        $('.hue-step-five').show();
        Cookies.set('hueGroups', selectedGroups.join(','), { expires: 3650 });
      } else {
        $('.hue-step-five').hide();
        Cookies.remove('hueGroups');
        Cookies.remove('hueEnabled');
      }
    });
  });
}

function resetHue() {
  $('.hue-step-two, .hue-step-three, .hue-step-four').hide();

  Cookies.remove('hueBridgeId');
  Cookies.remove('hueAccessToken');

  lastUrl = '';

  resetHueGroups();
}

function resetHueGroups() {
  $('.hue-step-five').hide();
  $('.select-groups-loading').show();
  $('.select-groups').empty();
  Cookies.remove('hueGroups');
  Cookies.remove('hueEnabled');
}
