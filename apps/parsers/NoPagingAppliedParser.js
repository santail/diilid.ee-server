'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser");

function NoPagingAppliedParser() {
  AbstractParser.call(this);
}

util.inherits(NoPagingAppliedParser, AbstractParser);

module.exports = NoPagingAppliedParser;