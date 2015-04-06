"use strict";
var util = require('util'),
  _ = require("underscore")._,
  request = require('request');

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
    proxies: [
    ],
    retries: 3,
    retryTimeout: 5 * 60 * 1000,
    timeout: 3 * 60 * 1000,
    debug: true
  };

  //return defaultOptions with overriden properties from options.
  self.options = _.extend(defaultOptions, options);
};

Crawler.prototype.request = function (url, onSuccess, onFailure) {
  var self = this,
    options = {
      uri: url
    },
    retries = self.options.retries;

  _.extend(options, self.options);

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


  function _makeRequest(options) {
    request(options, function (err, response, data) {
      if (err || response.statusCode !== 200 || !data) {
        console.log('Error ' + err + ' when fetching ' + self.options.uri + (self.options.retries ? ' (' + self.options.retries + ' retries left)' : ''));

        if (retries) {
          setTimeout(function () {
            retries--;

            // If there is a "proxies" option, rotate it so that we don't keep hitting the same one
            if (self.options.proxies) {
              options.proxies.push(options.proxies.shift());
            }

            _makeRequest(options);

          }, self.options.retryTimeout);
        }
        else {
          onFailure(err, response);
        }
      }
      else {
        onSuccess(data);
      }
    });
  }

  _makeRequest(options);
};

module.exports = Crawler;
