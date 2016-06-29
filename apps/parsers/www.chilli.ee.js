'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function ChillyParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.chilli.ee',
    'index': {
      'rus': 'http://ru.chilli.ee/?old-design=1',
      'est': 'http://www.chilli.ee/?old-design=1'
    },
    'list': function ($) {
      return $('div.product-container > div.product > div.product-img > a').map(function () {
        return $(this).attr('href');
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('body > div.listing-details > div.listing-main.grid-container > div.listing-main-details > h1').text());
      },
      'pictures': function ($, language) {
        var pictureUrls = [];

        $('body > div.listing-details > div.listing-main.grid-container > div.listing-images > div.image-gallery a').each(function () {
          pictureUrls.push(that.compileImageUrl(language, utils.unleakString($(this).attr('href'))));
        });

        $('body > div.listing-details > div:nth-child(3) > div.listing-description > div.listing-media > img').each(function () {
          pictureUrls.push(that.compileImageUrl(language, utils.unleakString($(this).attr('src'))));
        });

        return pictureUrls;
      },
      'description': function ($) {
        return utils.unleakString($('body > div.listing-details > div:nth-child(3) > div.listing-description > p:nth-child(5)').html());
      },
      'details': function ($) {
        var text = $('body > div.listing-details > div:nth-child(3) > div.listing-description > ul:nth-child(2)').html();

        text += $('body > div.listing-details > div:nth-child(3) > div.listing-description > ul:nth-child(3)').html();

        return utils.unleakString(text);
      },
      'original_price': function ($) {
        return that.priceCleanup($('body > div.listing-details > div.listing-main.grid-container > div.listing-main-details > p > span').text().);
      },
      'price': function ($) {
        $('body > div.listing-details > div.listing-main.grid-container > div.listing-main-details > p > span').remove();

        return that.priceCleanup($('body > div.listing-details > div.listing-main.grid-container > div.listing-main-details > p').text());
      },
      'vendor': function ($) {
        $('body div.content > div.main-content div.sidebar-box.shopping > div.text > h3 > a').remove();

        return $('body div.content > div.main-content div.sidebar-box.shopping > div.text > h3').text().trim();
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

  language = that.languages_reverse[language];

  return urlParser.resolve(that.config.index[language], link);
};

module.exports = ChillyParser;