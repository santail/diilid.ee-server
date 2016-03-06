'use strict';

var _ = require("underscore")._,
  async = require('async'),
  LOG = require("../services/Logger"),
  utils = require("../services/Utils"),
  request = require('request'),
  util = require("util");

function AbstractParser() {
  this.config = {};
  this.isInPakkumised = false;

  this.languages = {
    'rus': 'ru',
    'est': 'fi',
    'eng': 'en',
    'fin': 'fi'
  };

  this.languages_reverse = {
    'ru': 'rus',
    'et': 'est',
    'en': 'eng',
    'fi': 'est'
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
          decodeEntities: false
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

    LOG.profile("AbstractParser.parseOffer");

    return result;
  })(this, dom, language);

  callback(null, offer);
};

AbstractParser.prototype.gatherOffers = function (language, offerHandler, callback) {
  LOG.profile('Harvester.gatherOffers');

  var that = this,
    site = that.config.site,
    url = that.config.index[language];

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers from %s', site, language, url));

  async.waterfall([
      function stepRetrieveIndexPage(done) {
        LOG.profile('IndexRequest');

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] Fetching site index page %s', site, language, url));

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
          if (err || response.statusCode !== 200 || !data) {
            LOG.error({
              'message': util.format('[STATUS] [Failure] [%s] [%s] [%s] [%s] Error fetching site index page.', site, language, url, response.statusCode),
              'error': err.message
            });
          }

          LOG.profile('IndexRequest');
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Site index page received %s', site, language, response.statusCode, url));

          return done(err, data);
        });
      },
      function stepParseResponseBody(data, done) {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing index page body', site, language, url));
        
        that.parseResponseBody(data, function (err, dom) {
          if (err) {
            LOG.error({
              'message': 'Error parsing response body to DOM',
              'error': err.message
            });
          }
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing index page body finished', site, language, url));

          done(err, dom);
        });
      },
      function stepCheckPaging(dom, done) {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Checking index page contains paging', site, language, url));
        
        if (that.config.paging && that.config.paging.finit) {
          var pagingParams = that.getPagingParameters(language, dom);
          var pages = pagingParams.pages,
            pagesNumber = _.size(pages);

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Paging found %r', site, language, url, pagingParams));

          var functions = _.map(pages, function (pageUrl, index) {
            return function (finishPageProcessing) {
              dom = null;

              var options = {
                url: pageUrl,
                language: language, 
                handler: offerHandler,
                pageNumber: index + 1, 
                totalPages: pagesNumber
              };

              return that.processPage(options, finishPageProcessing);
            };
          });
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing %s pages started', site, language, pagesNumber));

          async.series(
            functions, 
            function (err, results) {
              if (err) {
                LOG.error({
                  'message': 'Error processing pages',
                  'error': err.message
                });
              }
              
              LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing %s pages finished', site, language, pagesNumber));
    
              done(err);
            }
          );
        }
        else {
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] No paging found', site, language, url));
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing offers started %s', site, language, url));

          var offers = that.getOffers(dom, language);

          dom = null;

          that.processOffers(language, offers, offerHandler, done);
        }
      }
    ],
    function onSiteIndexPageProcessed(err, result) {
      if (err) {
        LOG.error({
          'message': util.format('[STATUS] [Failure] [%s] [%s] Error gathering offers %s', site, language, url),
          'error': err.message
        });

        return callback(err);
      }

      LOG.profile('Harvester.gatherOffers');

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers finished %s', site, language, url));

      return callback();
    }
  );
};

AbstractParser.prototype.processPage = function (options, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site,
    url = options.url, 
    language = options.language, 
    offerHandler = options.handler;
  
  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing page %s of %s', site, language, options.pageNumber, options.totalPages));

  async.waterfall([
    function (done) {
      
      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Fetching page %s', site, language, url));
      
      request.get(url, {
          headers: {
            'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
            'accept-language': 'en-US,en;q=0.8',
            'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
          },
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        },
        function (err, response, data) {
          if (err || response.statusCode !== 200 || !data) {
            LOG.error({
              'message': util.format('[STATUS] [Failure] [%s] [%s] [%s] [%s] Error retrieving page.', site, language, url, response.statusCode),
              'error': err.message
            });
          }
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Page received %s', site, language, response.statusCode, url));

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
        that.processOffers(language, offers, offerHandler, done);
    }],
    function (err, result) {
      if (err) {
        LOG.error({
          'message': util.format('Error processing page for %s language %s: %s', site, language, url),
          'error': err.message
        });
      }
      
      LOG.profile('Harvester.processPage');

      callback(err, result);
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

      offerHandler(offer, done);
    };
  });

  async.series(
    functions, 
    function (err, links) {
      if (err) {
        LOG.error({
          'message': 'Error processing offers for site ' + site,
          'error': err.message
        });
      }
  
      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing offers finished %s', site, language, _.size(offers)));

      callback(err, links);
    }
  );
};

AbstractParser.prototype.fetchOffer = function (options, callback) {
  var that = this,
    id = options.id,
    site = options.site,
    language = options.language,
    url = options.url;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing offer %s', site, language, url));

  async.waterfall([
    function requestOffer(done) {
        LOG.profile('Retrieve offer');

        request({
          method: "GET",
          uri: url,
          headers: {
            'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
            'accept-language': 'en-US,en;q=0.8',
            'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
          },
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }, function requestOfferResult(err, response, data) {
          if (err || response.statusCode !== 200 || !data) {
            LOG.error({
              'message': util.format('[STATUS] [Failure] [%s] [%s] [%s] [%s] Error retrieving offer.', site, language, url, response.statusCode),
              'error': err.message
            });
          }

          LOG.profile('Retrieve offer');
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Offer received %s', site, language, response.statusCode, url));

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
              'message': util.format('[STATUS] [Failure] [%s] [%s] [%s] Error parsing offer.', site, language, url),
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
          'language': language,
          'active': true,
          'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
        });

        done(null, offer);
    }],
    function handleProcessOfferError(err, offer) {
      if (err) {
        LOG.error({
          'message': util.format('[STATUS] [Failure] [%s] [%s] [%s] [%s] Error processing offer.', site, language, url), 
          'error': err.message
        });
        
        return callback(err);
      }

      LOG.profile('Harvester.processOffer');

      LOG.profile("Harvester.saveOffer");

      LOG.info(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offer finished.', site, language, url));

      return callback(err, offer);
    });
};

module.exports = AbstractParser;
