"use strict";

var winston = require('winston');
var Logentries = require('winston-logentries');

var Logger = new winston.Logger({
  transports: [
    new winston.transports.Logentries({
      timestamp: true,
      token:'8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
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
      level: 'info'
    })
  ],
  exitOnError: false
});

module.exports = Logger;