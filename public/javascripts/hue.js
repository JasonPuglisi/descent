$(function() {
  $('.hue-bridge-id').on('paste focusout', function() {
    setTimeout(processHueBridgeId, 10);
  });
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
    setTimeout(processHueToken, 10);
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

      $('.hue-step-four').show();
    }
  }
}

