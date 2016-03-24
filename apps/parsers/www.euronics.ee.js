'use strict';

var util = require('util'),
  AbstractEuronicsParser = require("./AbstractEuronicsParser"),
  _ = require("underscore")._;

function EuronicsParser() {
  AbstractEuronicsParser.call(this);

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

util.inherits(EuronicsParser, AbstractEuronicsParser);

module.exports = EuronicsParser;

