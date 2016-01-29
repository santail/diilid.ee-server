'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function SelverParser() {
  AbstractParser.call(this);

  this.config = {
    'site': 'www.selver.ee',
    'cleanup': false,
    'reactivate': true
  };
}

util.inherits(SelverParser, AbstractParser);

module.exports = SelverParser;




// http://www.selver.ee/soodushinnaga-tooted?limit=96&p=12