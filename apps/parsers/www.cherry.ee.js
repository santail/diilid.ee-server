'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function CherryParser() {
  AbstractParser.call(this);

  this.config = {
    'site': 'www.cherry.ee',
    'cleanup': false,
    'reactivate': true,
    'index': {
      'rus': 'https://cherry.ee/ru/',
      'est': 'https://cherry.ee/et/'
    },
    'list': function ($) {
      return $('#themainthing div.offer-block div.row-of-deals div.offer-small div.info > h2 > a').map(function () {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('div#deal-info h2 > a').text());
      },
      'pictures': function ($) {
        return $('#deal-image div.carousel-inner div.item a > img').map(function () {
          return utils.unleakString($(this).attr('src'));
        }).get();
      },
      'description': function ($) {
        return utils.unleakString($('#themainthing div.offer-details div.offer-contents div.left-side div#long_text_container').html());
      },
      'details': function ($) {
        return utils.unleakString($('#themainthing div.offer-details div.offer-contents div.left-side > ul.pink-bullets').text());
      },
      'original_price': function ($) {
        return utils.unleakString($('div#deal-info > div.price-old').text()).replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').replace(/Tavahind: |Обычная цена: /, '').trim();
      },
      'price': function ($) {
        return utils.unleakString($('div#deal-info > div.price-big').text()).replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').trim();
      }

    }
  };
}

util.inherits(CherryParser, AbstractParser);

CherryParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

module.exports = CherryParser;