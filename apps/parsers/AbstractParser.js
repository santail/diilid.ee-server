'use strict';

var _ = require("underscore")._,
  async = require('async'),
  LOG = require("../services/Logger"),
  utils = require("../services/Utils"),
  request = require('request');

function AbstractParser() {
  this.config = {};
  this.isInPakkumised = false;

  this.languages = {
    'rus': 'ru',
    'est': 'fi',
    'eng': 'en',
    'fin': 'fi'
  };

  this.paging = {
    hasNextPage: function hasNextPage() {},
    nextPage: function nextPage() {}
  };
}

AbstractParser.prototype.getPaging = function () {
  return this.paging;
};

AbstractParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Create DOM from body', data);

  async.waterfall([
    function (done) {
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
          if (err) {
            LOG.error({
              'message': 'Error cleaning up HTML',
              'error': err.message
            });
          }

          LOG.profile("tidy");

          data = null;
          tidy = null;

          return done(err, body);
        });
    },
    function (body, done) {
        LOG.profile("cheerio");

        var cheerio = require("cheerio");

        var dom = cheerio.load(body, {
          normalizeWhitespace: true,
          lowerCaseTags: true,
          lowerCaseAttributeNames: true,
          recognizeCDATA: true,
          recognizeSelfClosing: true,
          decodeEntities: true
        });

        body = null;
        cheerio = null;

        LOG.profile("cheerio");

        return done(null, dom);
    }],
    function (err, dom) {
      if (err) {
        LOG.error({
          'message': 'Error parsing response body',
          'error': err.message
        });
      }

      return callback(err, dom);
    });
};

AbstractParser.prototype.getPagingParameters = function (language, dom) {
  var that = this;

  LOG.debug('Checking if paging exists.', language, dom);

  if (that.config.paging) {
    var paging = that.config.paging.applyParameters.call(that, language, dom);

    if (_.size(paging) > 0) {
      LOG.debug('Paging found. Total pages: ', _.size(paging.pages));
      LOG.debug('Paging properties:', paging);

      return paging;
    }

    LOG.debug('Paging not found.');
    return false;
  }

  LOG.debug('Paging is not configured.');
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

    var result = _parseTemplates(dom, templates, language);

    dom = null;

    _.extend(result, {
      'language': that.languages[language]
    });

    LOG.profile("AbstractParser.parseOffer");

    return result;
  })(this, dom, language);

  callback(null, offer);
};

AbstractParser.prototype.gatherOffers = function (language, processOffer, callback) {
  LOG.profile('Harvester.gatherOffers');

  var that = this,
    site = that.config.site;

  LOG.info('[STATUS] [OK] [', site, '] [', language, '] Processing started');

    async.waterfall([
      function stepRetrieveIndexPage(done) {
        LOG.profile('IndexRequest');

        var url = that.config.index[language];

        request({
          method: 'GET',
          uri: url,
          gzip: true,
          headers: {
            'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
            'accept-language': 'en-US,en;q=0.8',
            'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
          },
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }, function (err, response, data) {
          if (err) {
            LOG.error({
              'message': 'Error retrieving index page: ' + url,
              'error': err.message
            });
          }

          LOG.profile('IndexRequest');

          return done(err, utils.unleakString(data));
        });
      },
      function stepParseResponseBody(data, done) {
        that.parseResponseBody(data, function (err, dom) {
          if (err) {
            LOG.error({
              'message': 'Error parsing response body to DOM',
              'error': err.message
            });
          }

          done(err, dom);
        });
      },
      function stepCheckPaging(dom, done) {
        if (that.config.paging && that.config.paging.finit) {
          var pagingParams = that.getPagingParameters(language, dom);
          var pages = pagingParams.pages,
            pagesNumber = _.size(pages);

          var functions = _.map(pages, function (pageUrl, index) {
            return function (finishPageProcessing) {
              LOG.info('[STATUS] [OK] [', site, '] [', language, '] Processing page ' + (index + 1) + ' of ' + pagesNumber);

              dom = null;

              return that.processPage(pageUrl, language, processOffer, finishPageProcessing);
            };
          });

          async.series(functions, done);
        }
        else {
          var offers = that.getOffers(dom, language),
            linksNumber = _.size(offers);

          dom = null;

          LOG.debug('Total links found on page', linksNumber);

          that.processOffers(language, offers, processOffer, done);
        }
      }
    ], function onSiteIndexPageProcessed(err, result) {
      if (err) {
        LOG.error({
          'message': 'Error processing index page for ' + site + 'language ' + language ,
          'error': err.message
        });

        return callback(err);
      }

      LOG.profile('Harvester.gatherOffers');

      LOG.info('[STATUS] [OK] [', site, '] [', language, '] Processing finished');

      return callback();
    });
};

AbstractParser.prototype.processPage = function (url, language, processOffer, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site;

  LOG.debug('Processing page for', site, 'language', language, ':', url);

  async.waterfall([
    function (done) {
        request.get(url, {
            headers: {
              'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
              'accept-language': 'en-US,en;q=0.8',
              'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
            },
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
          },
          function (err, response, data) {
            if (err) {
              LOG.error({
                'message': 'Error retrieving page for ' + site + ' language ' + language + ': ' + url,
                'error': err.message
              });
            }

            return done(err, data);
          });
    },
    function (data, done) {
        that.parseResponseBody(data, function (err, body) {
          if (err) {
            LOG.error({
              'message': 'Error parsing response body to DOM',
              'error': err.message
            });
          }

          data = null;

          done(err, body);
        });
    },
    function (body, done) {
        var offers = that.getOffers(body, language),
          offersNumber = _.size(offers);

        LOG.debug('Total offers found on page', offersNumber);

        body = null;

        done(null, offers);
    },
    function (offers, done) {
      that.processOffers(language, offers, processOffer, done);
    }],
    function (err, result) {
      LOG.profile('Harvester.processPage');

      callback(err, result);
    });
};

AbstractParser.prototype.processOffers = function (language, offers, processOffer, callback) {
  (function (that, language, offers, processOffer, callback) {

    var site = that.config.site;

    var functions = _.map(offers, function (offer) {
      return function (done) {
        offer = _.extend(offer, {id: that.getOfferId(offer)});

        processOffer(offer, done);
      };
    });

    async.series(functions, function (err, links) {
      if (err) {
        LOG.error({
          'message': 'Error processing offers for site ' + site,
          'error': err.message
        });
      }

      callback(err, links);
    });

  }) (this, language, offers, processOffer, callback);
};

AbstractParser.prototype.fetchOffer = function (event, callback) {
  var that = this,
    id = event.id,
    site = event.site,
    language = event.language,
    url = event.url;

  LOG.info('Retrieving offer for', site, 'language', language, ':', url);

  async.waterfall([
    function requestOffer(done) {
      LOG.profile('Retrieve offer');
      request.get(url, {
        headers: {
          'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
          'accept-language': 'en-US,en;q=0.8',
          'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
        },
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      }, function requestOfferResult(err, response, data) {
        if (err) {
          LOG.error({
            'message': 'Error retrieving offer for ' + site + ' language ' + language + ': ' + url,
            'error': err.message
          });
        }

        LOG.profile('Retrieve offer');

        done(err, data);
      });
    },
    function parseResponseBody(data, done) {
      LOG.profile('Parse offer DOM');

      that.parseResponseBody(data, function parseResponseBodyResult(err, dom) {
        if (err) {
          LOG.error({
            'message': 'Error parsing response body to DOM',
            'error': err.message
          });
        }

        LOG.profile('Parse offer DOM');

        data = null;

        done(err, dom);
      });
    },
    function parseOffer(dom, done) {
      LOG.profile("parser.ParseOffer");

      that.parse(dom, language, function parseOfferResult(err, offer) {
        if (err) {
          LOG.error({
            'message': 'Error parsing data for ' + site + ' language ' + language + ': ' + url,
            'error': err.message
          });
        }

        LOG.profile("parser.ParseOffer");

        dom = null;

        return done(err, offer);
      });
    },
    function extendOffer(offer, done) {
      var runningTime = new Date();

      offer = _.extend(offer, {
        'id': id,
        'url': url,
        'site': site,
        'active': true,
        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
      });

      done(null, offer);
    }],
    function handleProcessOfferError(err, offer) {
      if (err) {
        LOG.error({
          'message': 'Error fetching offer for ' + site + ' language ' + language + ': ' + url,
          'error': err.message
        });
      }

      LOG.profile('Harvester.processOffer');

      LOG.profile("Harvester.saveOffer");

      LOG.debug('Saving offer', offer);

      return callback(err, offer);
  });
};

module.exports = AbstractParser;
