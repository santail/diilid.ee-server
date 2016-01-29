'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser");

function FinitPagingAppliedParser() {
  AbstractParser.call(this);
}

util.inherits(FinitPagingAppliedParser, AbstractParser);

module.exports = FinitPagingAppliedParser;