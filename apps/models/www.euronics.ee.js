'use strict';

var _ = require("underscore")._,
  util = require('util'),
  AbstractParser = require("./abstractParser");

function EuronicsParser() {
  AbstractParser.call(this);

  var that = this;

  this.config = {
    'site': 'www.euronics.ee',
    'reactivate': true,
    'index': {
      'rus': 'http://www.euronics.ee/products/c/143',
      'est': 'http://www.euronics.ee/tooted/c/143',
      'eng': 'http://www.euronics.ee/products-en/c/143'
    },
    'paging': function (language, $) {
      var pagination = $('div.oi-pagination ol li.page');

      var paging = {
        'pattern': '/nr/{pageNumber}',
        'first': pagination.first().text(),
        'last': pagination.last().text(),
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
    'list': function ($, language) {
      return $("#aspnetForm ul.oi-list.oi-grid-products > li > div > h2.name > a").map(function () {
        return $(this).attr('href');
      });
    },
    'templates': {
      'title': function ($) {
        return $('div.oi-section-main-content.clear div.oi-main-article-header > h1').text();
      },
      'pictures': function ($, language) {
        var pictureUrls = [];

        var mainPictureUrl = $('div.oi-section-main-content.clear div.oi-product-media > p.thumb > a').attr('href');

        if (mainPictureUrl) {
          pictureUrls.push(that.compileImageUrl(language, mainPictureUrl));
        }

        $('div.oi-section-main-content.clear div.oi-viewport-media > ol > li > a[data-img]').each(function () {
          pictureUrls.push(that.compileImageUrl(language, $(this).attr('href')));
        });

        return pictureUrls;
      },
      'description': {
        'short': function ($) {
          return $('div.oi-section-main-content.clear div.oi-product-description > div.oi-description > div[class!="oi-fb-like"]').html();
        },
        'long': function ($) {
          return '';
        }
      }
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