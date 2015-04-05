'use strict';

var util = require('util'),
    _ = require("underscore")._,
    AbstractParser = require("./abstractParser");

function PakkumisedParser() {
    AbstractParser.call(this);

    this.config = {
        'index': {
            'est': 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page='
        },
        'list': function ($) {

        },
        'templates': {
            'title': function ($) {
                return $('div#deal-info h2 > a').text();
            },
            'pictures': function ($) {
                return $('#deal-image div.carousel-inner div.item a > img').map(function () {
                    return $(this).attr('src');
                });
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

AbstractParser.prototype.getOfferLinks = function (language, body) {
  var that = this,
    offers = that.parseResponseBody(body);

  return _.map(_.keys(offers), function (offerId) {
    return that.compileOfferUrl(language, offers[offerId].url);
  });
};

PakkumisedParser.prototype.parseResponseBody = function (data) {
  console.log(data);
    return JSON.parse(data);
};

AbstractParser.prototype.getValidParser = function (url) {
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

module.exports = PakkumisedParser;