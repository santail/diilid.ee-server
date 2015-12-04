"use strict";
var config = require('../config/env');

var winston = require('winston');

require('winston-logentries');
require('winston-loggly');

winston.Logger.prototype.profile = function (id) {
  var now = Date.now(), then, args,
      msg, meta, callback;

  if (this.profilers[id]) {
    then = this.profilers[id];
    delete this.profilers[id];

    // Support variable arguments: msg, meta, callback
    args     = Array.prototype.slice.call(arguments);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    meta     = typeof args[args.length - 1] === 'object' ? args.pop() : {};
    msg      = args.length === 2 ? args[1] : id;

    // Set the duration property of the metadata
    meta.durationMs = now - then;

    return this.debug(msg, meta, callback);
  }
  else {
    this.profilers[id] = now;
  }

  return this;
};

var Logger = new winston.Logger({
  transports: [
    new winston.transports.Logentries({
      "timestamp": true,
      "token": config.harvester.logs.logentries.token
    }),
    new winston.transports.Loggly({
      "subdomain": config.harvester.logs.loggly.subdomain,
      "inputToken": config.harvester.logs.loggly.token,
      "tags": config.harvester.logs.loggly.tags,
      "json": true
    }),
    new(winston.transports.Console)({
      timestamp: true,
      handleExceptions: true,
      level: config.harvester.logs.level
    })
  ],
  exitOnError: false
});

module.exports = Logger;