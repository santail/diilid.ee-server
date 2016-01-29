// http://www.expert.ee/shop/special-list/product-list?type=discount&offset=12&sort=date_desc

'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function ExpertParser() {
  AbstractParser.call(this);

  this.config = {
    'site': 'www.cherry.ee',
    'cleanup': false,
    'reactivate': true
  };
}

util.inherits(ExpertParser, AbstractParser);

module.exports = ExpertParser;

