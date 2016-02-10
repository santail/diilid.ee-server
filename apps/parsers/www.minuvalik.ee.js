'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils"),
  _ = require("underscore")._;

function MinuvalikParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.minuvalik.ee',
    'cleanup': true,
    'reactivate': false,
    'index': {
      'rus': 'https://www.minuvalik.ee/ru/?c=all',
      'est': 'https://www.minuvalik.ee/?c=all'
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
      'intro': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_lead').html());
      },
      'short': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_descr').eq(1).html());
      },
      'long': function ($) {
        return utils.unleakString($('.deal_rules_td .dd_descr').first().html());
      },
      'original': function ($) {
        return utils.unleakString($('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.dd_basic_price').text());
      },
      'discount': function ($) {
        return utils.unleakString($('.deal_rules_td > div#parent_div > div> div.dd_table_price').text());
      },
      'save': function ($) {
        return utils.unleakString($('.deal_rules_td > div#parent_div div.dd_table_discount_info > span.fl_deals_fp_discount_row').text());
      },
      'shop': 'Minuvalik.ee'
    }
  };
}

util.inherits(MinuvalikParser, AbstractParser);

MinuvalikParser.prototype.compileImageUrl = function (language, link) {
  var that = this;

  language = _.invert(that.languages)[language];

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
