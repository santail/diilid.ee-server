'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function MinuvalikParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.minuvalik.ee',
    'index': {
      'rus': 'https://www.minuvalik.ee/ru/?c=all',
      'est': 'https://www.minuvalik.ee/?c=all'
    },
    'paging': {
      finit: true,
      applyParameters: function paging_func(language, $) {
        var pagination = $('div.stbst a.link_stbst');

        var paging = {
          'pattern': '&from={pageNumber}',
          'first': 1,
          'last': pagination.last().attr('href').replace(/.*from=(\d)/, "$1"),
          'pages': function pages() {
            var pages = [];

            for (var pageNumber = 1; pageNumber <= this.last; pageNumber++) {
              pages.push(that.compilePageUrl(language, this.pattern.replace('{pageNumber}', pageNumber)));
            }

            return pages;
          }
        };

        return {
          'first': paging.first,
          'last': paging.last,
          'pages': paging.pages()
        };
      }
    },
    'list': function ($) {
      return $('div.deals li > a').map(function () {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('.deal_rules_td > h1.title_deal').text());
      },
      'pictures': function ($, language) {
        return $('.deal_rules_td .dd_video_photo > a').map(function (i, el) {
          return that.compileImageUrl(language, utils.unleakString($(this).attr('href')));
        }).get();
      },
      'additional': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_lead').html());
      },
      'description': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_descr').eq(1).html());
      },
      'details': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_descr').first().html());
      },
      'original_price': function ($) {
        return that.priceCleanup($('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.dd_basic_price').text());
      },
      'price': function ($) {
        return that.priceCleanup($('.deal_rules_td > div#parent_div > div> div.dd_table_price').text());
      },
      'discount': function ($) {
        return that.priceCleanup($('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.fl_deals_fp_discount_row').text().replace(/alates |от /, ''));
      },
      'vendor': function ($) {
        return '';
      }
    }
  };
}

util.inherits(MinuvalikParser, AbstractParser);

MinuvalikParser.prototype.compileImageUrl = function (language, link) {
  var that = this;

  language = that.languages_reverse[language];

  return urlParser.resolve(that.config.index[language], link);
};

MinuvalikParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

MinuvalikParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

module.exports = MinuvalikParser;
