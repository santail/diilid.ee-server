"use strict";

var config = require('../config/environment'),
  _ = require("underscore")._,
  request = require('request'),
  LOG = require("./Logger");

function Crawler(options) {
  var self = this;
  self.init(options);
  self.counter = 0;
}

Crawler.prototype.init = function init(options) {
  var self = this;

  var firefox = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_4; en-US) AppleWebKit/534.7 (KHTML, like Gecko) Chrome/7.0.517.41 Safari/534.7';
  var chrome = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';

  var defaultOptions = {
    headers: {
      'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
      'accept-language': 'en-US,en;q=0.8',
      'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
    },
    'agents': [
      firefox,
      chrome
    ],
    proxies: config.harvester.proxies,
    retries: 3,
    retryTimeout: config.harvester.retryTimeout,
    requestInterval: config.harvester.requestInterval,
    debug: true,
    forceUTF: false
  };

  //return defaultOptions with overriden properties from options.
  self.options = _.extend(defaultOptions, options || {});
};

Crawler.prototype.request = function (url, callback) {
  var self = this,
    _options = {
      'headers': []
    },
    retries = self.options.retries;

  if (!self.options.headers) {
    self.options.headers = {};
  }
  if (self.options.forceUTF8) {
    if (!self.options.headers['Accept-Charset'] && !self.options.headers['accept-charset']) {
      self.options.headers['Accept-Charset'] = 'utf-8;q=0.7,*;q=0.3';
    }
    if (!self.options.encoding) {
      self.options.encoding = null;
    }
  }
  if (typeof self.options.encoding === 'undefined') {
    self.options.headers['Accept-Encoding'] = 'gzip';
    self.options.encoding = null;
  }

  if (self.options.agents) {
    var agent = self.options.agents.shift();
    _options.headers['User-Agent'] = agent;

    self.options.agents.push(agent);
  }

  if (self.options.referer) {
    _options.headers.Referer = self.options.referer;
  }

  if (self.options.proxies) {
    _options.proxy = self.options.proxies[0];
    self.options.proxies.push(self.options.proxies.shift());
  }

  var onError = function (err, response) {
    if (err) {
      LOG.error({
        'message': 'Error when fetching ' + url + ' ' + (retries ? '(' + retries + ' retries left)' : 'No retries left.') + ' ' + _options.proxy || '',
        'error': err.message
      });
    }
    else if (response.statusCode !== 200) {
      LOG.error({
        'message': 'Host ' + url + ' returned invalid status code: ' + response.statusCode + ' ' + (retries ? '(' + retries + ' retries left)' : 'No retries left.') + ' ' + _options.proxy || ''
      });
    }
    else {
      LOG.error({
        'message': 'Request ' + url + ' returned no data ' + (retries ? '(' + retries + ' retries left)' : 'No retries left.') + ' ' + _options.proxy || '',
        'statusCode': response.statusCode
      });
    }
  };

  var handler = function (err, response, data) {
    var config = _.extend({}, _options);

    retries--;

    if (err || response.statusCode !== 200 || !data) {

      onError(err, response);

      if (retries) {
        if (self.options.proxies) {
          config.proxy = self.options.proxies[0];
          self.options.proxies.push(self.options.proxies.shift());
        }

        request.get(url, config, handler);
      }
      else {
        return callback(err || new Error("Request failed. No retries left."), data);
      }
    }
    else {
      return callback(err, data);
    }
  };

  request.get(url, _options, handler);
};

module.exports = Crawler;
