'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./abstractParser");

function ChillyParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.chilli.ee',
    'cleanup': true,
    'reactivate': false,
    'index': {
      'rus': 'http://ru.chilli.ee/',
      'est': 'http://www.chilli.ee/'
    },
    'list': function ($) {
      return $('div.product-container > div.product > div.product-img > a').map(function () {
        return $(this).attr('href');
      }).get();
    },
    'templates': {
      'title': function ($) {
        return $('.product-container.single-product div.product > div.product-desc > h1').text();
      },
      'pictures': function ($, language) {
        var pictureUrls = [];

        $('.product-container.single-product div.product > div.product-img ul > li > img').each(function () {
          pictureUrls.push(that.compileImageUrl(language, $(this).attr('src')));
        });

        $('div.main-content div.gallery > img').each(function () {
          pictureUrls.push(that.compileImageUrl(language, $(this).attr('src')));
        });

        return pictureUrls;
      },
      'description': {
        'long': function ($) {
          return $('div.main-content .content').eq(1).html();
        },
        'condition': function ($) {
          return $('div.main-content .content').first().html();
        }
      },
      'price': {
        'original': function ($) {
          $('.product-container.single-product div.product > div.product-desc > div.bottom > div.price-box > p.special-price > span.old-price > span.old-price-text').remove();

          return $('.product-container.single-product div.product > div.product-desc > div.bottom > div.price-box > p.special-price > span.old-price').text().replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').trim();
        },
        'discount': function ($) {
          $('.product-container.single-product div.product > div.product-desc > div.bottom > div.price-box > p.special-price > span.old-price').remove();

          return $('.product-container.single-product div.product > div.product-desc > div.bottom > div.price-box > p.special-price').text().replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').trim();
        }
      }
    }
  };
}

util.inherits(ChillyParser, AbstractParser);

ChillyParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

ChillyParser.prototype.compileImageUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

module.exports = ChillyParser;