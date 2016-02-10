'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils"),
  _ = require("underscore")._;

function OnoffParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.onoff.ee',
    'cleanup': false,
    'reactivate': true,
    'index': {
      'rus': 'http://www.onoff.ee/font-colorb00000predlozenija-mesjatsafont/',
      'est': 'http://www.onoff.ee/font-colorb00000kuupakkumisedfont/',
      'eng': 'http://www.onoff.ee/font-colorb00000monthly-offersfont-eng/'
    },
    'list': function ($) {
      return $('div.content.catalog > ul.shop_prod > li > a').map(function () {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('div.center_box__right > h1.page_title').text());
      },
      'pictures': function ($, language) {
        var pictureUrls = [];

        var mainPictureUrl = utils.unleakString($('div.center_box__right > div.content.catalog > div.prod_in > div.prod_in__pic > a').attr('href'));

        if (mainPictureUrl) {
          pictureUrls.push(that.compileImageUrl(language, mainPictureUrl));
        }

        $('div.center_box__right > div.content.catalog > div.prod_in > div.prod_in__pic > ul > li > a').each(function () {
          pictureUrls.push(that.compileImageUrl(language, utils.unleakString($(this).attr('href'))));
        });

        return pictureUrls;
      },

      'short': function ($) {
        return utils.unleakString($('div.center_box__right > div.content.catalog > div.prod_in > div.prod_in__info table').eq(1).html());
      },
      'long': function ($) {
        return utils.unleakString($('div.center_box__right > div.content.catalog > div.prod_in > div.prod_in__text').text());

      },

      'discount': function ($) {
        var container = $('div.center_box__right > div.content.catalog > div.prod_in > form > div.shop_prod__price').first();

        container.children('span').remove();
        container.children('div').remove();
        container.children('a').remove();

        return utils.unleakString(container.text());
      },
      'save': function ($) {
        return utils.unleakString($('div.center_box__right > div.content.catalog > div.prod_in > div.shop_prod__procent').text());
      }
    }
  };
}

util.inherits(OnoffParser, AbstractParser);

OnoffParser.prototype.compileImageUrl = function (language, link) {
  var that = this;

  language = that.languages_reverse[language];

  return urlParser.resolve(that.config.index[language], link);
};

OnoffParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};


module.exports = OnoffParser;