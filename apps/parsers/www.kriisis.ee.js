'use strict';

var _ = require("underscore")._,
  util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./abstractParser");

function KriisisParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.kriisis.ee',
    'reactivate': true,
    'index': {
      'rus': 'http://www.kriisis.ee/ru/view_rating.php',
      'est': 'http://www.kriisis.ee/view_rating.php'
    },
    'paging': function (language, $) {
      var pagination = $('div.pstrnav > a');

      var paging = {
        'pattern': '?page={pageNumber}',
        'first': pagination.first().attr('href').replace(/.*page=(\d)/, "$1"),
        'last': pagination.last().attr('href').replace(/.*page=(\d)/, "$1"),
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
      return $('#01 > script').siblings('tr').eq(5).find('td').eq(1).find('table > tr > td table td > a').map(function () {
        return $(this).attr('href');
      });
    },
    'templates': {
      'shop': function ($) {
        return $('#01 > tr').eq(5).find('td').eq(1).find('table').first().find('tr > td > table').first().find('p').text().replace(/Pood: |Магазин: /, '');
      },
      'title': function ($, language) {
        var $paragraphs = $('#01 > tr').eq(5).children('td').eq(1).children('p');

        if (_.size($paragraphs) > 4) {
          $paragraphs.first().remove();
        }

        var rows = $('#01 > tr').eq(5).find('td').eq(1).children('p').eq(2);

        if (language === 'rus') {
          return rows.find('b').first().text();
        }

        return rows.text();
      },
      'pictures': function ($) {
        return [$('#01 > tr').eq(5).find('td').eq(1).find('table').first().find('tr > td > table').eq(2).find('tr > td > img').attr('src')];
      },
      'description': {
        'short': function ($, language) {
          var rows = $('#01 > tr').eq(5).find('td').eq(1).children('p').eq(2);

          if (language === 'rus') {
            return rows.find('b').first().text();
          }

          return rows.text();
        }
      },
      'price': {
        'sales': function ($) {
          return $('#01 > tr').eq(5).find('td').eq(1).children('p').eq(1).text().replace(/Hind: |Цена: /, '');
        }
      },
      'period': function ($) {
        return $('#01 > tr').eq(5).find('td').eq(1).children('p').eq(0).text().replace(/Kampaania periood: |Период кампании: /, '');
      }
    }
  };
}

util.inherits(KriisisParser, AbstractParser);

KriisisParser.prototype.compilePageUrl = function (language, link) {
  var that = this;

  return that.config.index[language] + link;
};

KriisisParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;

  return urlParser.resolve(that.config.index[language], link);
};

module.exports = KriisisParser;