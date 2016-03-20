'use strict';

var _ = require("underscore")._,
  async = require('async'),
  LOG = require("../services/Logger"),
  utils = require("../services/Utils"),
  request = require('request'),
  util = require("util");

function AbstractParser() {
  this.config = {
    'headers': {
      'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
      'accept-language': 'en-US,en;q=0.8',
      'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
    }
  };

  this.isInPakkumised = false;

  this.languages = {
    'rus': 'ru',
    'est': 'et',
    'eng': 'en',
    'fin': 'fi'
  };

  this.languages_reverse = {
    'ru': 'rus',
    'et': 'est',
    'en': 'eng',
    'fi': 'fin'
  };

  this.languageIso = {
    'en': 'en-US',
    'et': 'et-ET',
    'fi': 'fi-FI',
    'ru': 'ru-RU'
  };

  this.paging = {
    hasNextPage: function hasNextPage() {},
    nextPage: function nextPage() {}
  };
}

AbstractParser.prototype.request = function (options) {
  LOG.profile('Request');

  var that = this;

  var retries = 3;

  options = _.extend({
    method: 'GET',
    gzip: true,
    headers: that.config.headers,
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
  }, options);

  options = that.compileRequestOptions(options);

  var handler = function (err, response, data) {
    LOG.profile('Request');

    response = response || {};

    response.statusCode = 404;
    
    if (err || response.statusCode !== 200 || !data) {
      if (retries) {
        var timeout = Math.ceil(Math.random(1) * 10000);

        retries--;
        
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Fetching page failed. Retry in %s msec. Retries left %s', that.config.site, options.uri, timeout, retries, err));
        }
        else if (response.statusCode !== 200) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Fetching page failed. Retry in %s msec. Retries left %s', that.config.site, options.uri, response.statusCode, timeout, retries));
        }
        else {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Fetching page failed. No data received. Retry in %s msec. Retries left %s', that.config.site, options.uri, response.statusCode, timeout, retries));
        }

        setTimeout(function () {
          response = null;
          data = null;

          request(options, handler);
        }, timeout);
      }
      else {
        LOG.profile('Request');

        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Fetching page failed', that.config.site, options.uri, response.statusCode));

        retries = null;
        return options.onError(new Error('Error fetching page. No retries left.'));
      }
    }
    else {
      LOG.profile('Request');

      LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Fetching page finished', options.uri, response.statusCode));
      LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Parsing page body', that.config.site, options.uri));

      response = null;

      that.parseResponseBody(data, function (err, dom) {
        data = null;

        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Parsing page body failed %s', that.config.site, options.uri, err));
          return options.onError(err);
        }

        LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Parsing page body finished', that.config.site, options.uri));
        return options.onSuccess(null, dom);
      });
    }
  };

  try {
    request(options, handler);
  }
  catch (err) {
    return options.onError(err);
  }
};

AbstractParser.prototype.compileRequestOptions = function (options) {
  return options;
};

AbstractParser.prototype.getPaging = function () {
  return this.paging;
};

AbstractParser.prototype.parseResponseBody = function (data, callback) {
  var that = this;

  LOG.debug('Create DOM from body', data);

  LOG.profile("tidy");

  // TODO Warning: tidy uses 32 bit binary instead of 64, https://github.com/vavere/htmltidy/issues/11
  // TODO Needs manual update on production for libs

  var tidy = require('htmltidy').tidy;

  tidy(data, {
    doctype: 'html5',
    indent: false,
    bare: true,
    breakBeforeBr: false,
    hideComments: false,
    fixUri: false,
    wrap: 0
  }, function (err, body) {
    data = null;
    tidy = null;

    LOG.profile("tidy");

    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] Cleanup response body failed', that.config.site, err));
      return callback(err);
    }

    LOG.profile("cheerio");

    var cheerio = require("cheerio");

    var dom = cheerio.load(body, {
      normalizeWhitespace: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeCDATA: true,
      recognizeSelfClosing: true,
      decodeEntities: false
    });

    body = null;
    cheerio = null;

    LOG.profile("cheerio");

    return callback(null, dom);
  });
};

AbstractParser.prototype.getPagingParameters = function (language, dom) {
  var that = this;

  LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Checking paging', that.config.site, language));

  if (that.config.paging) {
    var paging = that.config.paging.applyParameters.call(that, language, dom);

    LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Checking paging finished %r', that.config.site, language, paging));

    if (_.size(paging) > 0) {
      return paging;
    }

    return false;
  }

  return false;
};

AbstractParser.prototype.getValidParser = function (url) {
  return this;
};

AbstractParser.prototype.getOfferId = function (data, language) {
  return data.id;
};

AbstractParser.prototype.getOffers = function (dom, language) {
  var that = this;

  var links = that.config.list.call(that, dom, language);

  return _.map(links, function (link) {
    return {
      'id': that.compileOfferUrl(language, link),
      'site': that.config.site,
      'language': that.languages[language],
      'url': that.compileOfferUrl(language, link)
    };
  });
};

AbstractParser.prototype.compileImageUrl = function compileImageUrl(language, link) {
  return link;
};

AbstractParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  return link;
};

AbstractParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  return link;
};

AbstractParser.prototype.getSite = function () {
  return this.config.site || '';
};

AbstractParser.prototype.parse = function parse(dom, language, callback) {
  var offer = (function (that, dom, language) {
    LOG.profile("AbstractParser.parseOffer");

    var templates = _.extend({}, that.config.templates);

    function _parseTemplates(dom, templates, language) {
      LOG.profile("AbstractParser._parseTemplates");

      var result = {};

      for (var key in templates) {

        if (templates.hasOwnProperty(key)) {
          var template = templates[key];

          if (typeof template === 'string') {
            result[key] = template;
          }
          else if (typeof template === 'object') {
            result[key] = _parseTemplates(dom, template, language);
          }
          else if (typeof template === 'function') {
            var value = template.call(null, dom, language);
            result[key] = typeof value === "string" ? utils.unleakString(value).trim().replace(/\t/g, ' ').replace(/\s\s+/g, ' ') : value;
          }
        }
      }

      LOG.profile("AbstractParser._parseTemplates");

      return result;
    }

    try {
      var result = _parseTemplates(dom, templates, language);

      dom = null;

      LOG.profile("AbstractParser.parseOffer");

      return result;
    }
    catch (err) {
      return callback(new Error(util.format("Error parsing templates", err)), offer);
    }

  })(this, dom, language);

  return callback(null, offer);
};

AbstractParser.prototype.gatherOffers = function (language, offerHandler, callback) {
  LOG.profile('Harvester.gatherOffers');

  var that = this,
    site = that.config.site,
    url = that.config.index[language];

  var resultHandler = function onSiteIndexPageProcessed(err, result) {
    LOG.profile('Harvester.gatherOffers');

    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Gathering offers failed', site, language, url, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers finished', site, language, url));
    return callback(null);
  };

  LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Fetching index page %s', site, language, url));

  that.request({
    uri: url,
    language: language,
    onError: resultHandler,
    onSuccess: function (err, dom) {
      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Checking index page contains paging', site, language, url));

      if (that.config.paging && that.config.paging.finit) {
        var pagingParams = that.getPagingParameters(language, dom);
        var pages = pagingParams.pages,
          totalPages = _.size(pages);

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Paging found %s', site, language, url, pagingParams));

        var functions = _.map(pages, function (pageUrl, index) {
          return function (finishPageProcessing) {
            dom = null;

            var options = {
              url: pageUrl,
              language: language,
              handler: offerHandler
            };

            LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page %s of %s', site, language, url, index + 1, totalPages));

            return that.processPage(options, finishPageProcessing);
          };
        });

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing %s pages started', site, language, totalPages));

        async.series(
          functions,
          function (err, results) {
            if (err) {
              LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing pages failed', site, language, err));
              return resultHandler(err);
            }

            LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing pages finished', site, language));
            return resultHandler(null);
          }
        );
      }
      else {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] No paging found', site, language, url));

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing offers started', site, language, url));

        try {
          var offers = that.getOffers(dom, language);
          dom = null;
          that.processOffers(language, offers, offerHandler, resultHandler);
        }
        catch (err) {
          dom = null;

          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offers failed', site, language, url, err));
          return resultHandler(err);
        }
      }
    }
  });
};

AbstractParser.prototype.processPage = function (options, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site,
    url = options.url,
    language = options.language,
    offerHandler = options.handler;

  var resultHandler = function (err, result) {
    LOG.profile('Harvester.processPage');

    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page finished', site, language, url));
    return callback(null, result);
  };

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching page', site, language, url));

  that.request({
    uri: url,
    language: language,
    onError: resultHandler,
    onSuccess: function (err, dom) {
      try {
        var offers = that.getOffers(dom, language);
        return that.processOffers(language, offers, offerHandler, resultHandler);
      }
      catch (err) {
        dom = null;

        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offers failed', site, language, url, err));
        return resultHandler(err);
      }
    }
  });
};

AbstractParser.prototype.processOffers = function (language, offers, offerHandler, callback) {
  var that = this,
    site = that.config.site;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing offers started %s', site, language, _.size(offers)));

  var functions = _.map(offers, function (offer) {
    return function (done) {
      offer = _.extend(offer, {
        id: that.getOfferId(offer)
      });

      return offerHandler(offer, done);
    };
  });

  async.parallel(
    functions,
    function (err, links) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing offers failed %s', site, language, err));
        return callback(null);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing offers finished %s', site, language, _.size(offers)));
      return callback(null, links);
    }
  );
};

AbstractParser.prototype.fetchOffer = function (options, callback) {
  var that = this,
    id = options.id,
    site = options.site,
    language = options.language,
    url = options.url;

  var resultHandler = function (err, offer) {
    LOG.profile('Harvester.processOffer');

    LOG.profile("Harvester.saveOffer");

    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offer failed %s', site, language, url, err));
      return callback(err);
    }

    LOG.debug(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing offer finished.', site, language, url));
    return callback(null, offer);
  };

  LOG.debug(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching offer started', site, language, url));

  that.request({
    uri: url,
    language: language,
    onError: resultHandler,
    onSuccess: function parseOffer(err, dom) {
      LOG.profile("parser.ParseOffer");

      that.parse(dom, language, function parseOfferResult(err, offer) {
        LOG.profile("parser.ParseOffer");

        dom = null;

        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Parsing offer failed', site, language, url, err));
          return resultHandler(err);
        }

        LOG.debug(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing offer finished', site, language, url));

        var runningTime = new Date();

        offer = _.extend(offer, {
          'id': id,
          'url': url,
          'site': site,
          'language': language,
          'active': true,
          'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
        });

        return resultHandler(null, offer);
      });
    }
  });
};

module.exports = AbstractParser;
