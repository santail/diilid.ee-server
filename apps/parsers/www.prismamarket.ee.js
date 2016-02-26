'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  _ = require("underscore")._,
  LOG = require("../services/Logger"),
  request = require('request'),
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
    'cleanup': false,
    'reactivate': true,
    'index': {
      'rus': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=ru&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'est': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=et&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'eng': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=en&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc',
      'fin': 'https://www.prismamarket.ee/api/?path=entry%2Fads&entry_type=PT&language=fi&limit=50&category_ids=16928&sort_order=relevancy&sort_dir=desc'
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

    var pageNumber = 0,
      pageRepeats = false;

    async.whilst(
      function () {
        return !pageRepeats;
      },
      function (finishPageProcessing) {
        LOG.info('[STATUS] [OK] [', site, '] [', language, '] Processing page ' + pageNumber);

        var pageUrl = paging.nextPageUrl(language, pageNumber);

        that.processPage(pageUrl, language, processOffer, function (err, result) {
          if (err) {
            LOG.error({
              'message': 'Error processing page from prismamarket.ee ' + pageUrl,
              'error': err.message
            });

            return finishPageProcessing(err);
          }

          var totalPages = result.totalPages;

          if ((pageNumber + 1) === totalPages) {
            pageRepeats = true;

            LOG.info('[STATUS] [OK] [', site, '] [', language, '] Total pages ' + totalPages);
          }

          pageNumber++;

          return finishPageProcessing(err);
        });
      },
      function (err) {
        if (err) {
          LOG.error({
            'message': 'Error processing site ' + site,
            'error': err.message
          });

          return callback(err);
        }

        return callback();
      }
    );
};

PrismamarketParser.prototype.processPage = function (url, language, processOffer, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    site = that.config.site;

  LOG.info('Processing page for', site, 'language', language, ':', url);

  async.waterfall([
    function (done) {
      request.get(url, {
          headers: {
            'Connection': 'keep-alive',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
            'Accept-Encoding': 'gzip, deflate, sdch',
            'Accept-Language': 'en-US,en;q=0.8,ru;q=0.6,et;q=0.4',
            'Cookie': 'is_new_user=1; _session_id=b426f59445bc396cfbbb78f8f0668beb'
          }
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

      callback(err, result);
    });
};

PrismamarketParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Parsing response');

  try {
    return callback(null, JSON.parse(data));
  }
  catch (ex) {
    LOG.error({
      'message': 'Error parsing JSON',
      'error': ex.message
    });

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
  var id = event.id,
    site = event.site,
    language = event.language;

  LOG.info('Retrieving offer for', site, 'language', language, ':', id);

  var runningTime = new Date();

  if (event.reprocessing || eventtest) {

  }
  else {

  }

  var offer = {
    'id': id,
    'site': site,
    'language': language,
    'active': true,
    'url': util.format('https://www.prismamarket.ee/api/?path=entry&ean=%s', event.ean),
    'title': event.name,
    'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear(),
    'campaign_start': event.campaign_start,
    'campaign_end': event.campaign_end,
    'price': event.price,
    'original_price': event.original_price,
    'pictures': [ util.format("https://s3-eu-west-1.amazonaws.com/balticsimages/images/320x480/%s.png", event.image_guid)],
    'subname': event.subname,
    'quantity': event.quantity,
    'unit_name': event.unit_name,
    'description': event.description,
    'shop': 'Prisma'
  };

  return callback(null, offer);
};

module.exports = PrismamarketParser;