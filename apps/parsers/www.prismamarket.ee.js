'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  _ = require("underscore")._,
  LOG = require("../services/Logger"),
  async = require("async");

function PrismamarketParser() {
  AbstractParser.call(this);

  var that = this;

  this.languages_reverse = {
    'ru': 'rus',
    'et': 'est',
    'en': 'eng',
    'fi': 'fin'
  };

  this.config = {
    'site': 'www.prismamarket.ee',
    'index': {
      'rus': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=ru&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'est': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=et&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'eng': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=en&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'fin': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=fi&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc'
    },
    'headers': {
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
      'Accept-Encoding': 'gzip, deflate, sdch',
      'Accept-Language': 'en-US,en;q=0.8,ru;q=0.6,et;q=0.4',
      'Cookie': 'is_new_user=1; _session_id=b426f59445bc396cfbbb78f8f0668beb'
    },
    'paging': {
      finit: true,
      nextPageUrl: function nextPageUrl(language, pageNumber) {
        return that.compilePageUrl(language, '&page={pageNumber}'.replace('{pageNumber}', pageNumber));
      }
    },
  };
}

util.inherits(PrismamarketParser, AbstractParser);

PrismamarketParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

PrismamarketParser.prototype.compileOfferUrl = function (language, link) {
  return link;
};

PrismamarketParser.prototype.gatherOffers = function (language, processOffer, callback) {
  var that = this,
    site = that.config.site,
    paging = that.config.paging;

  var url = paging.nextPageUrl(language, pageNumber);

  var pageNumber = 0,
    pageRepeats = false;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers started', site, language, url));

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      url = paging.nextPageUrl(language, pageNumber);
      
      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url));

      that.processPage(url, language, processOffer, function (err, result) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
          return finishPageProcessing(err);
        }

        var totalPages = result.totalPages;

        if ((pageNumber + 1) === totalPages) {
          pageRepeats = true;

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Gathering offers finished. Total pages %s', site, language, url, totalPages));
        }

        pageNumber++;

        return finishPageProcessing(err);
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

PrismamarketParser.prototype.processPage = function (url, language, processOffer, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url));

  async.waterfall([
    function (done) {
      
      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching page started', site, language, url));

      that.request({
        uri: url,
        onError: done,
        onSuccess: done
      });
    },
    function (data, done) {
        that.parseResponseBody(data, function (err, body) {
          data = null;

          if (err) {
            LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Parsing response body failed %s', site, language, url, err));
            return callback(err);
          }
          
          LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing response body finished', site, language, url));
          return done(null, body);
        });
    },
    function (body, done) {
        var offers = that.getOffers(body, language),
          offersNumber = _.size(offers.offers);

        LOG.info('Total offers found on page', offersNumber);

        body = null;

        done(null, offers);
    },
    function (offers, done) {
        that.processOffers(language, offers.offers, processOffer, function (err) {
          done(err, offers);
        });
    }],
    function (err, result) {
      LOG.profile('Harvester.processPage');
      
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Processing page failed %s', site, language, url, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page finished', site, language, url));
      return callback(null, result);
    });
};

PrismamarketParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Parsing response');

  try {
    return callback(null, JSON.parse(data));
  }
  catch (ex) {
    LOG.error(util.format('[STATUS] [Failure] Parse response body failed %s', ex));
    callback(new Error(ex.message));
  }
};

PrismamarketParser.prototype.getOffers = function (data, language) {
  var that = this;

  return {
    totalPages: data.message.categories[0].num_pages,
    pageNumber: data.message.categories[0].page,
    offers: _.map(data.message.categories[0].entries, function (link) {
      return _.extend(link, {
        'id': that.languages[language] + '_' + link.ean,
        'site': that.config.site,
        'language': that.languages[language]
      });
    })
  };
};

PrismamarketParser.prototype.fetchOffer = function (event, callback) {
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
    function (data, done) {
      that.parseResponseBody(data, function (err, body) {
        data = null;
        
        if (err) {
            LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Parsing response body failed %s', site, language, url, err));
            return done(err);
          }

        LOG.error(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing response body finished', site, language, url));
        done(null, body);
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

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Parsing offer finished', site, language, event.url));
        return done(null, offer);
      });
    },
    function extendOffer(offer, done) {
        var runningTime = new Date();

        offer = _.extend(offer, {
          'id': id,
          'site': site,
          'language': language,
          'active': true,
          'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
        });

        done(null, offer);
    }],
      function handleProcessOfferError(err, offer) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Fetching offer failed %s', site, language, event.url, err));
          return callback(err);
        }

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Fetching offer finished', site, language, event.url));
        return callback(err, offer);
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

PrismamarketParser.prototype.parse = function (data, language, callback) {
  var offer = {
    'title': data.name,
    'original_url': util.format('https://www.prismamarket.ee/?language=%s#!/entry/%s', language, data.ean),
    'url': util.format('https://www.prismamarket.ee/api/?path=entry&ean=%s', data.ean),
    'campaign_start': data.campaign_start,
    'campaign_end': data.campaign_end,
    'price': data.price,
    'original_price': data.original_price,
    'pictures': [util.format("https://s3-eu-west-1.amazonaws.com/balticsimages/images/320x480/%s.png", data.image_guid)],
    'subname': data.subname,
    'quantity': data.quantity,
    'unit_name': data.unit_name,
    'description': data.description,
    'vendor': 'Prisma'
  };

  return callback(null, offer);
};

module.exports = PrismamarketParser;