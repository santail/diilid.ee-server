'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils"),
  _ = require("underscore")._,
  LOG = require("../services/Logger"),
  async = require("async");

function eMaximaParser() {
  AbstractParser.call(this);

  var that = this;

  var config = {
    'site': 'www.e-maxima.ee',
    'headers': {
      'Pragma': 'no-cache',
      'Accept-Encoding': 'gzip, deflate, sdch',
      'Accept-Language': 'en-US,en;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36 Vivaldi/1.0.403.24',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.e-maxima.ee/Pages/Search/Products.aspx?jacobs&subcat=b2d7b08c-22a3-44cf-a53f-ce1bd8e814ed&UrlId=271579',
      'Cookie': 'lang={language}',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    },
    'index': {
      'rus': 'https://www.e-maxima.ee/Pages/Offers/',
      'est': 'https://www.e-maxima.ee/Pages/Offers/',
      'eng': 'https://www.e-maxima.ee/Pages/Offers/'
    },
    'paging': {
      'finit': true,
      'applyParameters': function (language, $) {
        var pagination = $('#main-content ul > li:not(.first, .back, .next, .last) > a');

        var firstPageUrl = pagination.first().attr('href');

        var paging = {
          'pattern': '/{pageNumber}.aspx',
          'first': utils.unleakString(pagination.first().text()),
          'last': utils.unleakString(pagination.last().text()),
          'pages': function () {
            var pages = [];

            for (var pageNumber = 1; pageNumber <= this.last; pageNumber++) {
              pages.push(that.compilePageUrl(language, firstPageUrl.replace(/\/d\.aspx/, this.pattern.replace('{pageNumber}', pageNumber))));
            }

            return pages;
          }
        };

        return {
          'first': paging.first,
          'last': paging.last,
          'pages': paging.pages()
        };
      }
    },
    'list': function ($, language) {
      return $('#main-content table.data tr > td > a').map(function () {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('#main-content > h1').text().trim());
      },
      'pictures': function ($, language) {
        return $('#ctl00_MainContent_productDetails_images > a, #ctl00_MainContent_prodDetails_images > a').map(function () {
          return utils.unleakString($(this).attr('href'));
        }).get();
      },
      'original_price': function ($) {
        return utils.unleakString($('#ctl00_MainContent_productDetails_campaignInDetailsTop_labelOldPrice, #ctl00_MainContent_prodDetails_campaignInDetailsTop_labelOldPrice').text().trim().replace(/€/g, '').trim());
      },
      'price': function ($) {
        return utils.unleakString($('#ctl00_MainContent_productDetails_campaignInDetailsTop_labelNewPrice, #ctl00_MainContent_prodDetails_campaignInDetailsTop_labelNewPrice').text().replace(/€/g, '').trim());
      },
      'description': function ($) {
        return utils.unleakString($('#ctl00_MainContent_productDetails_pnlDescription, #ctl00_MainContent_prodDetails_pnlDescription').html() || '');
      },
      'compaign_end': function ($) {
        return utils.unleakString($('#ctl00_MainContent_productDetails_repeaterCampaigns_ctl00_item_labelValidTill, #ctl00_MainContent_prodDetails_repeaterCampaigns_ctl00_item_labelValidTill').text().replace(/Pakkumine kehtib kuni |Акция действительна до |Offer valid until /, ''));
      },
      'vendor': 'Maxima'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(eMaximaParser, AbstractParser);

eMaximaParser.prototype.gatherOffers = function (language, offerHandler, callback) {
  LOG.profile('Harvester.gatherOffers');

  var that = this,
    site = that.config.site,
    url = that.config.index[language];

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers started', site, language, url));

  async.waterfall([
      function stepRetrieveIndexPage(done) {
        LOG.profile('IndexRequest');

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching site index page', site, language, url));

        that.request({
          uri: url,
          onError: done,
          onSuccess: done
        });
      },
      function stepProcessGroups($, done) {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing product groups', site, language, url));

        var groupUrls = $('#main-content > center > table > tbody > tr:nth-child(odd) > td > a').map(function list_iterator() {
          return utils.unleakString(that.compilePageUrl(language, $(this).attr('href')));
        }).get();

        var functions = _.map(groupUrls, function (pageUrl, index) {
          return function (finishCategoryPageProcessing) {
            var url = that.compilePageUrl(language, pageUrl);

            var options = {
              url: url,
              language: language,
              handler: offerHandler
            };

            return that.processProductGroupPage(options, finishCategoryPageProcessing);
          };
        });

        async.series(
          functions,
          function (err, results) {
            if (err) {
              LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing product groups failed %s', site, language, err));
              return done(err);
            }

            LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing product groups finished', site, language));
            return done();
          }
        );
      }
    ],
    function onSiteIndexPageProcessed(err, result) {
      LOG.profile('Harvester.gatherOffers');

      site = null;
      url = null;

      if (err) {
        LOG.error(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers failed %s', site, language, url, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers finished', site, language, url));
      return callback();
    }
  );
};

eMaximaParser.prototype.processProductGroupPage = function (options, callback) {
  LOG.profile('Harvester.gatherOffers');

  var that = this,
    site = that.config.site,
    url = options.url,
    language = options.language,
    handler = options.handler;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Process product group page started', site, language, url));

  async.waterfall([
      function stepRetrieveIndexPage(done) {
        LOG.profile('IndexRequest');

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching product group page', site, language, url));

        that.request({
          uri: url,
          onError: done,
          onSuccess: done
        });
      },
      function stepProcessGroups($, done) {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing product categories', site, language, url));

        var categoryUrls = $('#main-content > h2 > a').map(function list_iterator() {
          return utils.unleakString(that.compilePageUrl(language, $(this).attr('href')));
        }).get();

        var functions = _.map(categoryUrls, function (pageUrl, index) {
          return function (finishCategoryPageProcessing) {

            var options = {
              url: pageUrl,
              language: language,
              handler: handler
            };

            return that.processCategoryPage(options, finishCategoryPageProcessing);
          };
        });

        async.series(
          functions,
          function (err, results) {
            if (err) {
              LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing product categories failed', site, language, url));
              return done(err);
            }

            LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing product categories finished', site, language, url));
            return done();
          }
        );
      }
    ],
    function onSiteIndexPageProcessed(err, result) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing product group page failed %s', site, language, url, err));
        return callback(err);
      }

      LOG.profile('Harvester.gatherOffers');

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing product group page finished', site, language, url));
      return callback();
    }
  );
};

eMaximaParser.prototype.processCategoryPage = function (options, callback) {
  var that = this,
    site = that.config.site,
    url = options.url,
    language = options.language,
    offerHandler = options.handler;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Process product category page started', site, language, url));

  async.waterfall([
      function (done) {
        LOG.profile('IndexRequest');

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching product category page', site, language, url));

        that.request({
          uri: url,
          onError: done,
          onSuccess: done
        });
      },
      function stepCheckPaging(dom, done) {
        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Checking page contains paging', site, language, url));

        if (that.config.paging && that.config.paging.finit) {
          var pagingParams = that.getPagingParameters(language, dom);
          var pages = pagingParams.pages,
            pagesNumber = _.size(pages);

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Product category page paging found', site, language, url));
          LOG.debug(util.format('[Paging parameters]', pagingParams));

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

          async.series(
            functions,
            function (err, results) {
              if (err) {
                LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing offer pages failed', site, language, err));
                return done(err);
              }

              LOG.info(util.format('[STATUS] [OK] [%s] [%s] Processing %s pages finished', site, language, pagesNumber));
              return done();
            }
          );
        }
        else {
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] No paging found', site, language, url));

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing offers started %s', site, language, url));

          try {
            var offers = that.getOffers(dom, language);
            dom = null;
            that.processOffers(language, offers, offerHandler, done);
          }
          catch (err) {
            dom = null;

            LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offers failed', site, language, url, err));
            return done(err);
          }
        }
      }
    ],
    function onSiteIndexPageProcessed(err, result) {
      LOG.profile('Harvester.gatherOffers');

      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Processing offer category pages failed', site, language, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Product groups pages processing finished %s', site, language, url));
      return callback();
    }
  );
};

eMaximaParser.prototype.getOffers = function (dom, language) {
  var that = this;

  var links = that.config.list.call(that, dom, language);

  return _.map(links, function (link) {
    return {
      'id': that.languages[language] + '_' + that.compileOfferUrl(language, link),
      'site': that.config.site,
      'language': that.languages[language],
      'url': that.compileOfferUrl(language, link)
    };
  });
};

eMaximaParser.prototype.compileRequestOptions = function (options) {
  var that = this,
    headers = {};

  _.each(_.keys(that.config.headers), function(header) {
    headers[header] = that.config.headers[header].replace(/{language}/, that.languageIso[options.language]);
  });

  return _.extend(options, {
    'headers': headers
  });
};

eMaximaParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  link = link.replace(/&amp;/g, '&');
  return urlParser.resolve(this.config.index[language], link);
};

eMaximaParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  link = link.replace(/&amp;/g, '&');
  return urlParser.resolve(this.config.index[language], link);
};

module.exports = eMaximaParser;

