var STGaugeModule = (function() {
  var opts = {
    angle: -0.27, // The span of the gauge arc
    lineWidth: 0.19, // The line thickness
    radiusScale: 1, // Relative radius
    pointer: {
      length: 0.34, // // Relative to gauge radius
      strokeWidth: 0.044, // The thickness
      color: '#fff' // Fill color
    },
    limitMax: false, // If false, max value increases automatically if value > maxValue
    limitMin: false, // If true, the min value of the gauge will be fixed
    colorStart: '#6FADCF', // Colors
    colorStop: '#8FC0DA', // just experiment with them
    strokeColor: '#E0E0E0', // to see which ones work best for you
    generateGradient: true,
    highDpiSupport: true, // High resolution support
    percentColors: [[0.0, '#ff0000'], [0.5, '#f9c802'], [1.0, '#a9d70b']]
  };

  var downloadTarget = document.getElementById('test-download');
  var downloadGauge = new Gauge(downloadTarget).setOptions(opts);

  var uploadTarget = document.getElementById('test-upload');
  var uploadGauge = new Gauge(uploadTarget).setOptions(opts);

  function initGauge() {
    downloadGauge.maxValue = 100; // set max gauge value
    downloadGauge.setMinValue(0); // Prefer setter over gauge.minValue = 0
    downloadGauge.animationSpeed = 32; // set animation speed (32 is default value)
    downloadGauge.set(0); // set actual value

    uploadGauge.maxValue = 100; // set max gauge value
    uploadGauge.setMinValue(0); // Prefer setter over gauge.minValue = 0
    uploadGauge.animationSpeed = 32; // set animation speed (32 is default value)
    uploadGauge.set(0); // set actual value
  }

  function setDownloadGauge(speed) {
    downloadGauge.set(speed);
  }

  function setUploadGauge(speed) {
    uploadGauge.set(speed);
  }

  return {
    initGauge: initGauge,
    setUploadGauge: setUploadGauge,
    setDownloadGauge: setDownloadGauge
  };
})();
