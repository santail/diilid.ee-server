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
      "subdomain": "nikolaimuhhin",
      "inputToken": "baaf8934-7b4a-45ab-aa1f-688fa3e67f92",
      tags: ["NodeJS"],
      json:true
    }),
    new (winston.transports.Console)({
      timestamp: function() {
        return Date.now();
      },
      formatter: function (options) {
        // Return string will be passed to logger.
        return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
      },
      handleExceptions: true,
      level: config.harvester.logs.level
    })
  ],
  exitOnError: false
});

module.exports = Logger;