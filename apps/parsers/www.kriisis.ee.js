'use strict';

var _ = require("underscore")._,
  util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./abstractParser"),
  utils = require("../services/Utils");

function KriisisParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.kriisis.ee',
    'cleanup': true,
    'reactivate': false,
    'index': {
      'rus': 'http://www.kriisis.ee/ru/view_rating.php',
      'est': 'http://www.kriisis.ee/view_rating.php'
    },
    'paging': function paging_func(language, $) {
      var pagination = $('div.pstrnav > a');

      var paging = {
        'pattern': '?page={pageNumber}',
        'first': utils.unleakString(pagination.first().attr('href')).replace(/.*page=(\d)/, "$1"),
        'last': utils.unleakString(pagination.last().attr('href')).replace(/.*page=(\d)/, "$1"),
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
    },
    'list': function list($) {
      return $('#01 tr').eq(8).find('td').eq(1).find('table').first().find('td table td > a').map(function list_iterator() {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'shop': function shop($) {
        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > table td:first-child > table:first-child td:first-child > p').text()).replace(/Pood: |Магазин: /, '');
      },

      'pictures': function pictures($) {
        return [utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > table td:first-child > table:nth-child(3) td:first-child > img').attr('src'))];
      },
      'short': function short($, language) {
        if (language === 'rus') {
          return utils.unleakString($('#01 > tr').eq(5).find('td').eq(1).children('p').eq(2).find('b:first-child').text());
        }

        return utils.unleakString($('#01 > tr').eq(5).find('td').eq(1).children('p').eq(2).text());
      },
      'sales': function sales($) {
        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p:nth-child(4)').text()).replace(/Hind: |Цена: /, '');
      },
      'period': function period($) {
        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p:nth-child(3)').text()).replace(/Kampaania periood: |Период кампании: /, '');
      }
    }
  };
}

util.inherits(KriisisParser, AbstractParser);

KriisisParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  var that = this;

  return that.config.index[language] + link;
};

KriisisParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  var that = this;

  return urlParser.resolve(that.config.index[language], link);
};

module.exports = KriisisParser;