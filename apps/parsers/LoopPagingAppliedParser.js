'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser");

function LoopPagingAppliedParser() {
  AbstractParser.call(this);
}

LoopPagingAppliedParser.prototype.hasNextPage = function hasNextPage() {

};

LoopPagingAppliedParser.prototype.nextPage = function nextPage() {

}

util.inherits(LoopPagingAppliedParser, AbstractParser);

module.exports = LoopPagingAppliedParser;