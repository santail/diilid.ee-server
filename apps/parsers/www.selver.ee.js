'use strict';

var util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function SelverParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.selver.ee',
    'index': {
      'est': 'http://www.selver.ee/soodushinnaga-tooted?limit=96'
    },
    'paging': {
      finit: true,
      applyParameters: function paging_func(language, $) {
        var paging = {
          'pattern': '&p={pageNumber}',
          'first': 1,
          'last': $('body > div.main-container div.category-products > div.toolbar > div.pages > ol > li:nth-child(' + ($('body > div.main-container div.category-products > div.toolbar > div.pages > ol > li').length - 1) + ') > a').attr('href').replace(/.*p=(\d)/, "$1"),
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
    'list': function list($) {
      return $('#products-grid > li > a').map(function list_iterator() {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'vendor': function ($) {
        var header = $('#product-attribute-specs-table tr > th').filter(function () {
          return $(this).text() === 'Tootja';
        }).first();

        return header.next('td.data').text().replace(/Määramata/g, '');
      },
      'title': function ($, language) {
        return utils.unleakString($('div.product-essential.row div.page-title > h1').text());
      },
      'description': function ($) {
        return utils.unleakString($('div.product-essential.row div > span[itemprop="description"]').text());
      },
      'pictures': function ($, language) {
        return [utils.unleakString(that.compileImageUrl(language, $('#main-image-default > a').attr('href')))];
      },
      'price': function ($) {
        return that.priceCleanup($('div.product-essential div.price-box:first-child p.special-price span.price > span:nth-child(1)').text());
      },
      'original_price': function ($) {
        return that.priceCleanup($('div.product-essential div.price-box:nth-child(1) p.old-price span.price > span:nth-child(1)').text());
      }
    }
  };
}

util.inherits(SelverParser, AbstractParser);

SelverParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  var that = this;

  return that.config.index[language] + link;
};

SelverParser.prototype.compileImageUrl = function (language, link) {
  return "http" + link;
};

SelverParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  var that = this;

  return urlParser.resolve(that.config.index[language], link);
};

module.exports = SelverParser;