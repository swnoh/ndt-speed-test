if (typeof simulate === 'undefined') {
  var simulate = false;
}

$(function() {
  jQuery.fx.interval = 50;
  if (simulate) {
    setTimeout(initializeTest, 1000);
    return;
  }
  initializeTest();
});

// CONSTANTS

// Testing phases

var PHASE_LOADING = 0;
var PHASE_WELCOME = 1;
var PHASE_PREPARING = 2;
var PHASE_UPLOAD = 3;
var PHASE_DOWNLOAD = 4;
var PHASE_RESULTS = 5;

// STATUS VARIABLES
var use_websocket_client = false;
var websocket_client = null;
var currentPhase = PHASE_LOADING;
var currentPage = 'welcome';
var transitionSpeed = 400;

// A front-end implementation could define some specific server. If not, then
// just use the current server's hostname.
if (typeof window.ndtServer === 'undefined') {
  // Toronto Server
  var ndtServer = 'ndt-iupui-mlab1-yul02.measurement-lab.org';

  // Find a close ndt server
  // var ndtServer;
  // $.ajax({
  //   url: 'https://mlab-ns.appspot.com/ndt?format=json',
  //   type: 'GET',
  //   dataType: 'JSON',
  //   success: function(data) {
  //     ndtServer = data.fqdn;
  //   },
  //   error: function(error) {
  //     console.log(error);
  //     debug('Failed to get NDT server.');
  //   }
  // });
}

// Gauges used for showing download/upload speed
var downloadGauge, uploadGauge;
var gaugeUpdateInterval;
var gaugeMaxValue = 100;

// PRIMARY METHODS

function initializeTest() {
  // Initialize gauges
  STGaugeModule.initGauge();

  $('#test-upload-value').html('--');
  $('#test-download-value').html('--');
  $('#st-status-button').html('Start Test');

  // Initialize start buttons
  $('#st-status-button').click(startTest);

  $('#results').hide();

  setPhase(PHASE_WELCOME);
}

function startTest(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  websocket_client = new NDTWrapper(window.ndtServer);

  $('#rttValue').html('');
  if (simulate) return simulateTest();
  currentPhase = PHASE_WELCOME;
  testNDT().run_test(ndtServer);
  monitorTest();
}

function simulateTest() {
  setPhase(PHASE_RESULTS);
  return;
  setPhase(PHASE_PREPARING);
  setTimeout(function() {
    setPhase(PHASE_UPLOAD);
  }, 2000);
  setTimeout(function() {
    setPhase(PHASE_DOWNLOAD);
  }, 4000);
  setTimeout(function() {
    setPhase(PHASE_RESULTS);
  }, 6000);
}

function monitorTest() {
  var message = testError();
  var currentStatus = testStatus();

  if (message.match(/not run/) && currentPhase != PHASE_LOADING) {
    setPhase(PHASE_WELCOME);
    return false;
  }
  if (message.match(/completed/) && currentPhase < PHASE_RESULTS) {
    setPhase(PHASE_RESULTS);
    return true;
  }
  if (message.match(/failed/) && currentPhase < PHASE_RESULTS) {
    setPhase(PHASE_RESULTS);
    return false;
  }
  if (currentStatus.match(/Outbound/) && currentPhase < PHASE_UPLOAD) {
    setPhase(PHASE_UPLOAD);
  }
  if (currentStatus.match(/Inbound/) && currentPhase < PHASE_DOWNLOAD) {
    setPhase(PHASE_DOWNLOAD);
  }

  if (
    !currentStatus.match(/Middleboxes/) &&
    !currentStatus.match(/notStarted/) &&
    !remoteServer().match(/ndt/) &&
    currentPhase == PHASE_PREPARING
  ) {
    debug('Remote server is ' + remoteServer());
    setPhase(PHASE_UPLOAD);
  }

  if (remoteServer() !== 'unknown' && currentPhase < PHASE_PREPARING) {
    setPhase(PHASE_PREPARING);
  }

  setTimeout(monitorTest, 1000);
}

// PHASES

function setPhase(phase) {
  // console.log('setPhase: ' + phase);
  switch (phase) {
    case PHASE_WELCOME:
      debug('WELCOME');
      showPage('welcome');
      break;

    case PHASE_PREPARING:
      STGaugeModule.setUploadGauge(0);
      STGaugeModule.setDownloadGauge(0);
      $('#test-upload-value').html('--');
      $('#test-download-value').html('--');

      $('#results').hide();

      $('#st-status-button').removeClass('btn-danger');
      $('#st-status-button').addClass('btn-secondary');
      $('#st-status-button').html('Preparing Test...');
      $('#st-status-button').prop('disabled', true);

      debug('PREPARING TEST');
      break;

    case PHASE_UPLOAD:
      var pcBuffSpdLimit = speedLimit();
      debug('UPLOAD TEST');

      $('#st-status-button').removeClass('btn-secondary');
      $('#st-status-button').addClass('btn-info');
      $('#st-status-button').html('Upload Testing...');

      if (!isNaN(pcBuffSpdLimit)) {
        if (pcBuffSpdLimit > gaugeMaxValue) {
          pcBuffSpdLimit = gaugeMaxValue;
        }
      }

      gaugeUpdateInterval = setInterval(function() {
        updateGaugeValue();
      }, 1000);

      break;

    case PHASE_DOWNLOAD:
      debug('DOWNLOAD TEST');

      if (!isNaN(pcBuffSpdLimit)) {
        if (pcBuffSpdLimit > gaugeMaxValue) {
          pcBuffSpdLimit = gaugeMaxValue;
        }
      }

      $('#st-status-button').html('Download Testing...');
      break;

    case PHASE_RESULTS:
      debug('SHOW RESULTS');
      debug('Testing complete');

      $('#results').show();
      $('#st-status-button').removeClass('btn-info');
      $('#st-status-button').addClass('btn-danger');
      $('#st-status-button').html('Test Again');
      $('#st-status-button').removeAttr('disabled');

      printDownloadSpeed();
      printUploadSpeed();
      printPing();

      $('#result-diagnosis').append(testDiagnosis());

      showPage('results');
      break;

    default:
      return false;
  }
  currentPhase = phase;
}

// PAGES

function showPage(page, callback) {
  debug('Show page: ' + page);
  if (page == currentPage) {
    if (callback !== undefined) callback();
    return true;
  }
  if (currentPage !== undefined) {
    $('#' + currentPage).fadeOut(transitionSpeed, function() {
      $('#' + page).fadeIn(transitionSpeed, callback);
    });
  } else {
    debug('No current page');
    $('#' + page).fadeIn(transitionSpeed, callback);
  }
  currentPage = page;
}

// GAUGE

function updateGaugeValue() {
  var downloadSpeedVal = getJustfiedSpeed(downloadSpeed());
  var uploadSpeedVal = getJustfiedSpeed(uploadSpeed(false));

  if (currentPhase == PHASE_UPLOAD) {
    $('#test-upload-value').html(uploadSpeedVal);
    STGaugeModule.setUploadGauge(uploadSpeedVal);
  } else if (currentPhase == PHASE_DOWNLOAD) {
    $('#test-download-value').html(downloadSpeedVal);
    STGaugeModule.setDownloadGauge(downloadSpeedVal);
  } else {
    clearInterval(gaugeUpdateInterval);
  }
}

// TESTING JAVA/WEBSOCKET CLIENT

function testNDT() {
  if (websocket_client) {
    return websocket_client;
  }

  return $('#NDT');
}

function testStatus() {
  return testNDT().get_status();
}

function testDiagnosis() {
  var diagnosisValues = JSON.parse(testNDT().get_diagnosis());
  var dTag = '';
  var sortKeys = [];

  for (var key in diagnosisValues) {
    sortKeys.push(key);
  }

  sortKeys.sort(function(a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  dTag += '<table><tbody>';
  sortKeys.forEach(function(key) {
    dTag += '<tr>';
    dTag += '<td>' + key + '</td>';
    dTag += '<td>' + diagnosisValues[key] + '</td>';
    dTag += '</tr>';
  });
  dTag += '</tbody></table>';

  return dTag;
}

function testError() {
  return testNDT().get_errmsg();
}

function remoteServer() {
  if (simulate) return '0.0.0.0';
  return testNDT().get_host();
}

function uploadSpeed(raw) {
  if (simulate) return 0;
  var speed = testNDT().getNDTvar('ClientToServerSpeed');
  return raw ? speed : parseFloat(speed);
}

function downloadSpeed() {
  if (simulate) return 0;
  return parseFloat(testNDT().getNDTvar('ServerToClientSpeed'));
}

function ping() {
  if (simulate) return 0;
  return parseFloat(testNDT().getNDTvar('MinRTT'));
}

function speedLimit() {
  if (simulate) return 0;
  return parseFloat(testNDT().get_PcBuffSpdLimit());
}

function getSpeedUnit(speedInKB) {
  var unit = ['kb/s', 'Mb/s', 'Gb/s', 'Tb/s', 'Pb/s', 'Eb/s'];
  var e = Math.floor(Math.log(speedInKB * 1000) / Math.log(1000));
  return unit[e];
}

function getJustfiedSpeed(speedInKB) {
  var e = Math.floor(Math.log(speedInKB) / Math.log(1000));
  return (speedInKB / Math.pow(1000, e)).toFixed(2);
}

function printDownloadSpeed() {
  var downloadSpeedVal = downloadSpeed();
  $('#download-speed').html(getJustfiedSpeed(downloadSpeedVal));
  $('#download-speed-units').html(getSpeedUnit(downloadSpeedVal));
}

function printUploadSpeed() {
  var uploadSpeedVal = uploadSpeed(false);
  $('#upload-speed').html(getJustfiedSpeed(uploadSpeedVal));
  $('#upload-speed-units').html(getSpeedUnit(uploadSpeedVal));
}

function printPing() {
  var pingValue = ping();
  $('#ping').html(pingValue);
}

function printNumberValue(value) {
  return isNaN(value) ? '-' : value;
}

// UTILITIES

function debug(message) {
  if (typeof allowDebug !== 'undefined') {
    if (allowDebug && window.console) console.debug(message);
  }
}

function isPluginLoaded() {
  try {
    testStatus();
    return true;
  } catch (e) {
    return false;
  }
}

// Attempts to determine the absolute path of a script, minus the name of the
// script itself.
function getScriptPath() {
  var scripts = document.getElementsByTagName('SCRIPT');
  var fileRegex = new RegExp('/ndt-wrapper.js$');
  var path = '';
  if (scripts && scripts.length > 0) {
    for (var i in scripts) {
      if (scripts[i].src && scripts[i].src.match(fileRegex)) {
        path = scripts[i].src.replace(fileRegex, '');
        break;
      }
    }
  }
  return path.substring(location.origin.length);
}
