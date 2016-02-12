'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function EuronicsParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.euronics.ee',
    'cleanup': false,
    'reactivate': true,
    'index': {
      'rus': 'http://www.euronics.ee/products/c/143',
      'est': 'http://www.euronics.ee/tooted/c/143',
      'eng': 'http://www.euronics.ee/products-en/c/143'
    },
    'paging': {
      'finit': true,
      'applyParameters': function (language, $) {
        var pagination = $('div.oi-pagination ol li.page');

        var paging = {
          'pattern': '/nr/{pageNumber}',
          'first': utils.unleakString(pagination.first().text()),
          'last': utils.unleakString(pagination.last().text()),
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
      }
    },
    'list': function ($, language) {
      return $("#aspnetForm ul.oi-list.oi-grid-products > li > div > h2.name > a").map(function () {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'title': function ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-main-article-header > h1').text());
      },
      'pictures': function ($, language) {
        var pictureUrls = [];

        var mainPictureUrl = utils.unleakString($('div.oi-section-main-content.clear div.oi-product-media > p.thumb > a').attr('href'));

        if (mainPictureUrl) {
          pictureUrls.push(that.compileImageUrl(language, mainPictureUrl));
        }

        $('div.oi-section-main-content.clear div.oi-viewport-media > ol > li > a[data-img]').each(function () {
          var href = utils.unleakString($(this).attr('href'));
          pictureUrls.push(that.compileImageUrl(language, href));
        });

        return pictureUrls;
      },
      'original_price': function  ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-bottom > ul > li > p > span.old-price').text().replace(/Норм. цена |Normal price |Norm hind /, ''));
      },
      'price': function ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-bottom > ul > li > p > span.new-price').text());
      },
      'discount': function ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-bottom > ul > li > p > span.discount').text());
      },
      'description': function ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-description > div[class!="oi-fb-like"]').html());
      },
      'shop': 'euronics.ee'
    }
  };
}

util.inherits(EuronicsParser, AbstractParser);

EuronicsParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

EuronicsParser.prototype.compileOfferUrl = function (language, link) {
  return link;
};

module.exports = EuronicsParser;