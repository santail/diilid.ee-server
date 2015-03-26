'use strict';

var path = require('path');
var _ = require('underscore')._;

function requiredProcessEnv (name) {
  if(!process.env[name]) {
    throw new Error('You must set the ' + name + ' environment variable');
  }
  return process.env[name];
}

// All configurations will extend these options
// ============================================
var all = {
  env: process.env.NODE_ENV,

  // Root path of server
  root: path.normalize(__dirname + '/..'),

  // Server port
  port: process.env.PORT || 9000,

  // MongoDB connection options
  mongo: {
    options: {
      db: {
        safe: true
      }
    }
  },
  harvester: {
    timeout: 30000
  },
  pakkumised: true,
  activeSites: {
      'www.minuvalik.ee': true,
      'www.cherry.ee': true,
      'www.euronics.ee': true,
      'www.kriisis.ee': true
  }
};

// Export the config object based on the NODE_ENV
// ==============================================
module.exports = _.extend(
  all,
  require('./' + requiredProcessEnv('NODE_ENV') + '.js') || {});