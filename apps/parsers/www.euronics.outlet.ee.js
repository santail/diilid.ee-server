'use strict';

var util = require('util'),
  AbstractEuronicsParser = require("./AbstractEuronicsParser"),
  _ = require("underscore")._,
  utils = require("../services/Utils");

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
  
  this.config.templats.price = function ($) {
    return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-bottom > ul > li > p > span').text());
  };
}

util.inherits(EuronicsOutletParser, AbstractEuronicsParser);

module.exports = EuronicsOutletParser;