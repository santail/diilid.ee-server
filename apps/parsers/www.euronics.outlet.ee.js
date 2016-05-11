'use strict';

var util = require('util'),
  AbstractEuronicsParser = require("./AbstractEuronicsParser"),
  _ = require("underscore")._;

function EuronicsOutletParser() {
  AbstractEuronicsParser.call(this);

  var config = {
    'site': 'www.euronics.outlet.ee',
    'index': {
      'rus': 'https://www.euronics.ee/products/status/outlet',
      'est': 'https://www.euronics.ee/tooted/status/outlet',
      'eng': 'https://www.euronics.ee/products-en/status/outlet'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(EuronicsOutletParser, AbstractEuronicsParser);

module.exports = EuronicsOutletParser;