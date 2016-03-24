'use strict';

var util = require('util'),
  EuronicsParser = require("./www.euronics.ee.js"),
  _ = require("underscore")._;

function EuronicsOutletParser() {
  EuronicsParser.call(this);

  var config = {
    'site': 'www.euronics.ee',
    'index': {
      'rus': 'https://www.euronics.ee/products/status/outlet/c/143',
      'est': 'https://www.euronics.ee/tooted/status/outlet/c/143',
      'eng': 'https://www.euronics.ee/products-en/status/outlet/c/143'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(EuronicsOutletParser, EuronicsParser);

module.exports = EuronicsOutletParser;