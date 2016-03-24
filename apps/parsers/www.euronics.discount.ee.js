'use strict';

var util = require('util'),
  AbstractEuronicsParser = require("./AbstractEuronicsParser"),
  _ = require("underscore")._;

function EuronicsDiscountParser() {
  AbstractEuronicsParser.call(this);

  var config = {
    'site': 'www.euronics.discount.ee',
    'index': {
      'rus': 'http://www.euronics.ee/products/c/143',
      'est': 'http://www.euronics.ee/tooted/c/143',
      'eng': 'http://www.euronics.ee/products-en/c/143'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(EuronicsDiscountParser, AbstractEuronicsParser);

module.exports = EuronicsDiscountParser;