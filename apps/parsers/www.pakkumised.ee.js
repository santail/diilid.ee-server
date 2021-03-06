'use strict';

var util = require('util'),
  _ = require("underscore")._,
  AbstractParser = require("./AbstractParser"),
  LOG = require("../services/Logger"),
  async = require("async");

function PakkumisedParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.pakkumised.ee',
    'index': {
      'est': 'http://pakkumised.ee/acts/offers/js_load.php'
    },
    'paging': {
      finit: false,
      nextPageUrl: function nextPageUrl(language, pageNumber) {
        return that.compilePageUrl(language, '?page={pageNumber}'.replace('{pageNumber}', pageNumber));
      }
    },
    'templates': {
      'title': function ($) {
        return $('div#deal-info h2 > a').text();
      },
      'pictures': function ($) {
        return $('#deal-image div.carousel-inner div.item a > img').map(function () {
          return $(this).attr('src');
        }).get();
      },
      'description': {
        'short': function ($) {
          // TODO needs to be cleared out
          return $('#themainthing div.offer-details div.offer-contents div.left-side div#long_text_container').html();
        },
        'long': function ($) {
          // TODO needs to be cleared out
          return $('#themainthing div.offer-details div.offer-contents div.left-side').html();
        }
      }
    }
  };
}

util.inherits(PakkumisedParser, AbstractParser);

PakkumisedParser.prototype.getOffers = function (data, language) {
  var that = this;

  return _.map(data, function (offer) {
    return {
      'id': that.compileOfferUrl(language, offer.url),
      'site': that.config.site,
      'language': that.languages[language],
      'url': that.compileOfferUrl(language, offer.url)
    };
  });
};

PakkumisedParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Parsing response');

  try {
    return callback(null, JSON.parse(data));
  }
  catch (ex) {
    LOG.error(util.format('[STATUS] [Failure] Parse response body failed %s', ex));
    return callback(new Error(ex.message));
  }
};

PakkumisedParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  var that = this;

  return that.config.index[language] + link;
};

PakkumisedParser.prototype.getValidParser = function (url) {
  var Parser = require(__dirname + '/abstractParser.js');

  if (url.indexOf('minuvalik.ee') > -1) {
    Parser = require(__dirname + '/www.minuvalik.ee.js');
  }

  if (url.indexOf('headiil.ee') > -1) {
    // Parser = require(__dirname + '/www.headiil.ee.js');
  }

  if (url.indexOf('hotelliveeb.ee') > -1) {
    // Parser = require(__dirname + '/www.hotelliveeb.ee.js');
  }

  if (url.indexOf('chilli.ee') > -1) {
    // Parser = require(__dirname + '/www.chilli.ee.js');
  }

  if (url.indexOf('cherry.ee') > -1) {
    Parser = require(__dirname + '/www.cherry.ee.js');
  }

  if (url.indexOf('niihea.ee') > -1) {
    // Parser = require(__dirname + '/www.niihea.ee.js');
  }

  if (url.indexOf('crazydeal.ee') > -1) {
    // Parser = require(__dirname + '/www.crazydeal.ee.js');
  }

  if (url.indexOf('soodushind.ee') > -1) {
    // Parser = require(__dirname + '/www.soodushind.ee.js');
  }

  if (url.indexOf('soodus24.ee') > -1) {
    // Parser = require(__dirname + '/www.soodus24.ee.js');
  }

  if (url.indexOf('ostulaine.ee') > -1) {
    // Parser = require(__dirname + '/www.ostulaine.ee.js');
  }

  return new Parser();
};

PakkumisedParser.prototype.gatherOffers = function (language, processOffer, callback) {
  var that = this,
    site = that.config.site,
    paging = that.config.paging;

  var pageNumber = 0,
    pageRepeats = false,
    lastUrl = null;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers started', site, language));

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      pageNumber++;

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Processing page started', site, language, url, pageNumber));

      var url = paging.nextPageUrl(language, pageNumber);

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

          LOG.info(util.format('[STATUS] [OK] [%s] [%s] Gathering offers finished', site, language, pageNumber));
        }

        return finishPageProcessing();
      });
    },
    function (err) {
      pageNumber = null;
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

module.exports = PakkumisedParser;