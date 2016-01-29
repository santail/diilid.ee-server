'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function OstulaineParser() {
  AbstractParser.call(this);

  this.config = {
    'site': 'www.cherry.ee',
    'cleanup': false,
    'reactivate': true
  };
}

util.inherits(OstulaineParser, AbstractParser);

module.exports = OstulaineParser;

