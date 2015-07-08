"use strict";
var config = require('../config/environment');

var winston = require('winston');

require('winston-logentries');
require('winston-loggly');

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
      timestamp: function () {
        return Date.now();
      },
      formatter: function (options) {
        // Return string will be passed to logger.
        return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
      },
      handleExceptions: true,
      level: config.harvester.logs.level
    })
  ],
  exitOnError: false
});

module.exports = Logger;