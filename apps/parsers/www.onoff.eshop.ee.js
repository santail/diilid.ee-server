'use strict';

var util = require('util'),
  OnoffParser = require("./www.onoff.ee.js"),
    _ = require("underscore")._;

function OnoffEshopParser() {
  OnoffParser.call(this);

  var config = {
    'site': 'www.onoff.eshop.ee',
    'index': {
      'rus': 'http://www.onoff.ee/font-color3dcc00tolko-v-e-magazinefont/',
      'est': 'http://www.onoff.ee/font-color3dcc00ainult-e-poesfont/',
      'eng': 'http://www.onoff.ee/font-color3dcc00only-onlinefont/'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(OnoffEshopParser, OnoffParser);

module.exports = OnoffEshopParser;