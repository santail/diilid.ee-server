'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./abstractParser");

function MinuvalikParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.minuvalik.ee',
    'reactivate': true,
    'cleanup': false,
    'index': {
      'rus': 'https://www.minuvalik.ee/ru/?c=all',
      'est': 'https://www.minuvalik.ee/?c=all'
    },
    'paging': function (language, $) {
      var pagination = $('div.content_div.center.deals div > div.t17.pt10 > a');

      var paging = {
        'pattern': '?c=all&from={pageNumber}',
        'first': 1,
        'last': pagination.last().attr('href').replace(/.*from=(\d)/, "$1"),
        'pages': function () {
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
    },
    'list': function ($) {
      return $('div.deals li > a').map(function () {
        return $(this).attr('href');
      });
    },
    'templates': {
      'title': function ($) {
        return $('.deal_rules_td > h1.title_deal').text();
      },
      'pictures': function ($, language) {
        return $('.deal_rules_td .dd_video_photo > a').map(function () {
          return that.compileImageUrl(language, $(this).attr('href'));
        });
      },
      'description': {
        'intro': function ($) {
          return $('.deal_rules_td .dd_lead').html();
        },
        'short': function ($) {
          return $('.deal_rules_td .dd_descr').eq(1).html();
        },
        'long': function ($) {
          return $('.deal_rules_td .dd_descr').first().html();
        }
      },
      'price': {
        'original': function ($) {
          return $('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.dd_basic_price').text();
        },
        'discount': function ($) {
          return $('.deal_rules_td > div#parent_div > div> div.dd_table_price').text();
        },
        'save': function ($) {
          return $('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.fl_deals_fp_discount_row').text();
        }
      }
    }
  };
}

util.inherits(MinuvalikParser, AbstractParser);

MinuvalikParser.prototype.compileImageUrl = function (language, link) {
  var that = this;
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
