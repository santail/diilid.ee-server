'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  _ = require("underscore")._,
  LOG = require("../services/Logger"),
  async = require("async");

function EcoopParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.ecoop.ee',
    'index': {
      'rus': 'https://ecoop.ee/api/v1/products?page={pageNumber}&ordering=popularity&has_discount=1&language_code=ru',
      'est': 'https://ecoop.ee/api/v1/products?page={pageNumber}&ordering=popularity&has_discount=1&language_code=et'
    },
    'headers': {
      'Host': 'ecoop.ee',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Accept': 'application/json',
      'X-CSRFToken': '',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36 Vivaldi/1.2.490.43',
      'Referer': 'https://ecoop.ee/sooduspakkumised/koik/',
      'Accept-Encoding': 'gzip, deflate, sdch, break',
      'Accept-Language': 'en-US,en;q=0.8'
    },
    'paging': {
      finit: true,
      nextPageUrl: function nextPageUrl(language, pageNumber) {
        return that.config.index[language].replace('{pageNumber}', pageNumber);
      }
    }
  };
}

util.inherits(EcoopParser, AbstractParser);

EcoopParser.prototype.gatherOffers = function (language, processOffer, callback) {
  var that = this,
    site = that.config.site,
    paging = that.config.paging;

  var pageNumber = 1,
    itemsProcessed = 0,
    pageRepeats = false;

  var url = paging.nextPageUrl(language, pageNumber);

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers started', site, language, url));

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      url = paging.nextPageUrl(language, pageNumber);

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url));

      var options = {
        url: url,
        language: language,
        handler: processOffer
      };

      var pagePostProcess = function (err, result) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
          return finishPageProcessing(err);
        }

        var totalItems = result.totalItems;
        itemsProcessed = itemsProcessed + result.offers.length;

        if (itemsProcessed === totalItems) {
          pageRepeats = true;

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers finished. Total items %s', site, language, url, itemsProcessed));
        }

        pageNumber++;

        return finishPageProcessing(err);
      };

      that.processPage(options, pagePostProcess);
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

EcoopParser.prototype.processPage = function (options, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site,
    url = options.url,
    language = options.language,
    offerHandler = options.handler;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url));

  var resultHandler = function (err, result) {
    LOG.profile('Harvester.processPage');

    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
      return callback(err);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page finished', site, language, url));
    return callback(null, result);
  };

  that.request({
    uri: url,
    onError: resultHandler,
    onSuccess: function (err, dom) {
      try {
        var offers = that.getOffers(dom, language);

        return that.processOffers(language, offers.offers, offerHandler, function (err, result) {
          return resultHandler(err, offers);
        });
      }
      catch (err) {
        dom = null;

        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing offers failed', site, language, url, err));
        return resultHandler(err);
      }
    }
  });
};

EcoopParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Parsing response');

  try {
    return callback(null, JSON.parse(data));
  }
  catch (ex) {
    LOG.error(util.format('[STATUS] [Failure] Parse response body failed %s', ex));
    callback(new Error(ex.message));
  }
};

EcoopParser.prototype.getOffers = function (data, language) {
  var that = this;

  return {
    totalItems: data.count,
    offers: _.map(data.results, function (item) {
      return _.extend(item, {
        'id': that.languages[language] + '_' + item.skuid,
        'site': that.config.site,
        'language': that.languages[language]
      });
    })
  };
};

EcoopParser.prototype.fetchOffer = function (event, callback) {
  var that = this,
    id = event.id,
    site = event.site,
    language = event.language;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Retrieving offer %s', site, language, id));

  if (event.refresh || event.test) {
    var url = event.url;

    async.waterfall([
      function (done) {

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching offer started', site, language, url));

        that.request({
          uri: url,
          language: language,
          onError: done,
          onSuccess: done
        });
    },
    function parseOffer(dom, done) {
      LOG.profile("parser.ParseOffer");

      that.parse(dom.message.entry, language, function parseOfferResult(err, offer) {
        LOG.profile("parser.ParseOffer");

        dom = null;

        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Parsing offer failed %s', site, language, event.url, err));
          return done(err);
        }

        var runningTime = new Date();

        offer = _.extend(offer, {
          'id': id,
          'site': site,
          'language': language,
          'active': true,
          'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
        });

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing offer finished', site, language, event.url));
        return done(null, offer);
      });
    }],
    function handleProcessOfferError(err, offer) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Fetching offer failed %s', site, language, event.url, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching offer finished', site, language, event.url));
      return callback(null, offer);
    });
  }
  else {
    that.parse(event, language, function parseOfferResult(err, offer) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Parsing offer failed %s', site, language, event.url, err));
        return callback(err);
      }

      LOG.profile("parser.ParseOffer");

      var runningTime = new Date();

      offer = _.extend(offer, {
        'id': id,
        'site': site,
        'language': language,
        'active': true,
        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
      });

      event = null;

      return callback(null, offer);
    });
  }
};

EcoopParser.prototype.parse = function (data, language, callback) {
  var offer = {
    'title': data.name,
    'url': util.format('https://ecoop.ee/api/v1/products?skuid=%s', data.skuid),
    'campaign_start': data.campaigns[0].start_date,
    'campaign_end': data.campaigns[0].end_date,
    'price': data.campaigns[0].discounts[0].price,
    'original_price': data.sell_price,
    'pictures': data.images[0].productimage,
    'vendor': data.meta.producer
  };

  return callback(null, offer);
};

module.exports = EcoopParser;