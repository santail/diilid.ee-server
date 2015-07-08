"use strict";
var config = require('../config/environment'),
  util = require('util'),
  _ = require("underscore")._,
  request = require('request'),
  LOG = require("./Logger");

function Crawler(options) {
  var self = this;
  self.init(options);
}

Crawler.prototype.init = function init(options) {
  var self = this;

  var firefox = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_4; en-US) AppleWebKit/534.7 (KHTML, like Gecko) Chrome/7.0.517.41 Safari/534.7';
  var chrome = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';

  var defaultOptions = {
    headers: {
      'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
      'accept-language': 'en-US,en;q=0.8',
      'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
      'agents': [firefox, chrome]
    },
    proxies: [],
    retries: 3,
    retryTimeout: config.harvester.retryTimeout,
    timeout: 3 * 60 * 1000,
    debug: true
  };

  //return defaultOptions with overriden properties from options.
  self.options = _.extend(defaultOptions, options);
};

Crawler.prototype.request = function (url, callback) {
  var self = this,
    options = self.options,
    retries = self.options.retries;

  if (self.options.agents) {
    options.headers['User-Agent'] = self.options.agents.shift();
  }

  if (self.options.referer) {
    options.headers.Referer = options.referer;
  }

  if (self.options.proxies && self.options.proxies.length) {
    options.proxies = self.options.proxies;
    options.proxy = self.options.proxies[0];
  }

  var handler = function (err, response, data) {
    retries--;

    if (err || response.statusCode !== 200 || !data) {

      if (err) {
        LOG.error({
          'message': 'Error when fetching ' + url + (retries ? ' (' + retries + ' retries left)' : 'No retries left.'),
          'error': err.message
        });
      }
      else if (response.statusCode !== 200) {
        LOG.error({
          'message': 'Host ' + url + ' returned invalid status code: ' + response.statusCode + '. ' + (retries ? '(' + retries + ' retries left)' : 'No retries left.')
        });
      }
      else if (!data) {
        LOG.error({
          'message': 'Request ' + url + ' returned no data: ' + data + '. ' + (retries ? '(' + retries + ' retries left)' : 'No retries left.'),
          'statusCode': response.statusCode,
          'data': data
        });
      }

      if (retries) {

        setTimeout(function () {
          // If there is a "proxies" option, rotate it so that we don't keep hitting the same one
          if (options.proxies) {
            options.proxies.push(options.proxies.shift());
          }

          _makeRequest(url, options);

        }, options.retryTimeout);

      }
      else {
        return callback(err || new Error("Request failed. No retries left."), data);
      }
    }
    else {
      return callback(err, data);
    }
  };


  function _makeRequest(url, options) {
    try {
      request.get(url, options, handler);
    }
    catch (ex) {
      LOG.error({
        'message': 'Error retrieving content by http request',
        'error': ex.message
      });

      return callback(ex);
    }
  }

  _makeRequest(url, options);
};

module.exports = Crawler;
