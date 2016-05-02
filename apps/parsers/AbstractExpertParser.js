'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  _ = require("underscore")._,
  urlParser = require("url"),
  LOG = require("../services/Logger"),
  async = require("async"),
  utils = require("../services/Utils");

function AbstractExpertParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'list': function ($, language) {
      return $('p.heading01 > a.js-link-product.img').map(function () {
        return that.compileOfferUrl(language, $(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('#content > div.col00 > div h1').text());
      },
      'pictures': function ($, language) {
        return $('#slider02 ul.navigation01 a').map(function () {
          return that.compileImageUrl(language, $(this).attr('href'));
        }).get();
      },
      'description': function ($) {
        return utils.unleakString($('#tab01 > div').html());
      },
      'details': function ($) {
        return utils.unleakString($('#tab02 > div').html());
      },
      'price': function ($) {
        return utils.unleakString($('#content > div.col00 p.price > span').text().trim());
      },
      'original_price': function ($) {
        return $('#content > div.col00 p.price > del').text().trim();
      },
      'discount': function ($) {
        return $('#content > div.col00 p.price > small').text().trim().replace(/Hinnavõit: /, '');
      },
      'vendor': function ($) {
        $('body div.content > div.main-content div.sidebar-box.shopping > div.text > h3 > a').remove();

        return $('body div.content > div.main-content div.sidebar-box.shopping > div.text > h3').text().trim();
      }
    }
  };
}

util.inherits(AbstractExpertParser, AbstractParser);

AbstractExpertParser.prototype.gatherOffers = function (language, processOffer, callback) {
  var that = this,
    site = that.config.site,
    paging = that.config.paging;

  var offset = 0,
    pageRepeats = false,
    lastUrl = null;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers started', site, language));

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      var url = paging.nextPageUrl(language, offset);

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

        offset += 12;

        return finishPageProcessing();
      });
    },
    function (err) {
      offset = null;
      pageRepeats = null;
      lastUrl = null;

      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Gathering offers failed %s', site, language, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers finished', site, language));
      return callback();
    }
  );
};

AbstractExpertParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  var that = this;

  return urlParser.resolve(that.config.index[language], link);
};

AbstractExpertParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  var that = this;

  return urlParser.resolve(that.config.index[language], link);
};

AbstractExpertParser.prototype.compileImageUrl = function compileImageUrl(language, link) {
  var that = this;

  language = that.languages_reverse[language];

  return urlParser.resolve(that.config.index[language], link);
};

module.exports = AbstractExpertParser;

