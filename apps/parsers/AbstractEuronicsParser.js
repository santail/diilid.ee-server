'use strict';

var util = require('util'),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils"),
  _ = require("underscore")._;

function AbstractEuronicsParser() {
  AbstractParser.call(this);

  var that = this;

  var config = {
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
        var modelId = $('div.oi-section-main-content.clear > div.oi-main-article-header > p.productID > span[itemprop="productID"]').text().trim();
        var title = $('div.oi-section-main-content.clear div.oi-main-article-header > h1').text().trim();

        return util.format('%s %s', title, modelId);
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
      'original_price': function ($) {
        if ($('div.oi-product-description p.price > span.old-price').length === 1) {
          return utils.unleakString($('div.oi-product-description p.price > span.old-price').text().replace(/Норм. цена |Normal price |Norm hind /, '').replace(/ €/g, ''));
        }

        return '';
      },
      'price': function ($) {
        if ($('div.oi-product-description p.price > span.new-price').length === 1) {
          return $('div.oi-product-description p.price > span.new-price').text().replace(/ €/g, '');
        }

        return utils.unleakString($('div.oi-product-description p.price > span').text().replace(/ €/g, ''));
      },
      'discount': function ($) {
        if ($('div.oi-product-description p.price > span.old-price').length === 1) {
          return utils.unleakString($('div.oi-product-description p.price > span.discount').text().replace(/ €/g, ''));
        }

        return '';
      },
      'description': function ($) {
        return utils.unleakString($('div.oi-section-main-content.clear div.oi-product-description > div.oi-description > div[class!="oi-fb-like"]').html());
      },
      'vendor': 'Euronics'
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(AbstractEuronicsParser, AbstractParser);

AbstractEuronicsParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

AbstractEuronicsParser.prototype.compileOfferUrl = function (language, link) {
  return link;
};

module.exports = AbstractEuronicsParser;