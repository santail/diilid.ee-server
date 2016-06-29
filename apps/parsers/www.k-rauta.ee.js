'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  _ = require("underscore")._,
  utils = require("../services/Utils"),
  LOG = require("../services/Logger"),
  async = require("async");

function KRautoParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.k-rauta.ee',
    'index': {
      'est': 'https://www.k-rauta.ee/Products'
    },
    'headers': {
      'Host': 'www.k-rauta.ee',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Accept': 'text/html, */*; q=0.01',
      'Origin': 'https://www.k-rauta.ee',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://www.k-rauta.ee/ehituspood/kampaania',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'en-US,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36'
    },
    'paging': {
      finit: true,
      nextPageUrl: function nextPageUrl(language, pageNumber) {
        return that.compilePageUrl(language, '?searchType=&filterTerm=&langId=4&advancedSearch=&sType=SimpleSearch&gridPosition=&manufacturer=&ajaxStoreImageDir=%2Fwcsstore%2FRautakeskoSAS%2F&resultCatEntryType=&catalogId=14001&searchTerm=&resultsPerPage=40&emsName=&facet=&categoryId=291503&storeId=10703&disableProductCompare=false&ddkey=ProductListingView_9_2127_59112&filterFacet=&pageNum={pageNumber}&orderBy=5&pageSize=40&timeout=60000&campaignPage=true'.replace('{pageNumber}', pageNumber));
      }
    },
    'list': function ($, language) {
      return $('#product_listing > li > div.product > div.product_info > div.product_name > a').map(function () {
        return that.compileOfferUrl(language, $(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        var eanCodes = Array.prototype.join.call($('#productpage-product-info h3 span').map(function () {
          return $(this).text();
        }), ", ");

        return utils.unleakString($('#productpage-product-info h1.main_header').text().trim()) + ' ' + eanCodes;
      },
      'pictures': function ($, language) {
        return $('div.product-images a').map(function () {
          return that.compileImageUrl(language, $(this).attr('href'));
        }).get();
      },
      'description': function ($) {
        return utils.unleakString($('div.the-short-description > p').text());
      },
      'details': function ($) {
        return utils.unleakString($('div.product-description > p').text());
      },
      'price': function ($) {
        return that.priceCleanup($('#product-options div.price-options span.price.show-vat').text());
      },
      'original_price': function ($) {
        return that.priceCleanup($('#product-options div.price-options span.old_price span.old_price_price.show-vat').text());
      },
      'period': function ($) {
        return $('#product-options div.price-options span.discounted_price_suffix').text().trim().replace(/Pakkumine kehtib kuni:/, '');
      },
      'vendor': function ($) {
        return utils.unleakString($('#productpage-product-info h2[itemprop="brand"]').text().trim());
      }
    }
  };
}

util.inherits(KRautoParser, AbstractParser);

KRautoParser.prototype.gatherOffers = function (language, processOffer, callback) {
  var that = this,
    site = that.config.site,
    paging = that.config.paging;

  var pageNumber = 0,
    pageRepeats = false,
    lastUrl = null;

  var url = paging.nextPageUrl(language, pageNumber);

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers started', site, language, url));

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      var url = paging.nextPageUrl(language, pageNumber);

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url));

      var options = {
        url: url,
        language: language,
        handler: processOffer
      };

      that.processPage(options, function (err, links) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
          return finishPageProcessing(err);
        }

        if (!_.isEmpty(links) && lastUrl !== _.last(links)) {
          lastUrl = _.last(links);
        }
        else {
          pageRepeats = true;
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
        }

        pageNumber++;

        return finishPageProcessing();
      });
    },
    function (err) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Gathering offers failed %s', site, language, url, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers finished', site, language, url));
      return callback();
    }
  );
};

KRautoParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

KRautoParser.prototype.compileOfferUrl = function (language, link) {
  return link;
};

module.exports = KRautoParser;
