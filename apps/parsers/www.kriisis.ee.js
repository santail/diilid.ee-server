'use strict';

var _ = require("underscore")._,
  util = require('util'),
  urlParser = require("url"),
  AbstractParser = require("./AbstractParser"),
  utils = require("../services/Utils");

function KriisisParser() {
  var that = this;

  AbstractParser.call(this);

  this.config = {
    'site': 'www.kriisis.ee',
    'cleanup': false,
    'reactivate': true,
    'index': {
      'rus': 'http://www.kriisis.ee/ru/view_rating.php',
      'est': 'http://www.kriisis.ee/view_rating.php'
    },
    'paging': {
      finit: true,
      applyParameters: function paging_func(language, $) {
        var pagination = $('div.pstrnav > a');

        var paging = {
          'pattern': '?page={pageNumber}',
          'first': pagination.first().attr('href').replace(/.*page=(\d)/, "$1"),
          'last': pagination.last().attr('href').replace(/.*page=(\d)/, "$1"),
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
      return $('#01 tr').eq(8).find('td').eq(1).find('table').first().find('td table td > a').map(function list_iterator() {
        return utils.unleakString($(this).attr('href'));
      }).get();
    },
    'templates': {
      'vendor': function shop($) {
        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > table td:first-child > table:first-child td:first-child > p').text().replace(/Pood: |Магазин: /, ''));
      },
      'title': function ($, language) {
        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 1) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(4)').next('p').children('strong:first-child').text());
        }

        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 2) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(5)').next('p').children('strong:first-child').text());
        }

        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(3)').next('p').children('strong:first-child').text());
      },
      'pictures': function pictures($) {
        return [utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > table td:first-child > table:nth-child(3) td:first-child > img').attr('src'))];
      },
      'description': function short($, language) {
        var description = $('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(3)').next('p');

        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 1) {
         description = $('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(4)').next('p');
        }

        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 2) {
          description = $('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(5)').next('p');
        }

        description.children('strong:first-child').remove();
        description.children('br').remove();

        if (language === 'rus') {
          description.children('b').remove();
        }

        return utils.unleakString(description.text());
      },
      'price': function sales($) {
        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 1) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(4)').text().replace(/Hind: |Цена: /, ''));
        }

        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 2) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(5)').text().replace(/Hind: |Цена: /, ''));
        }

        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(3)').text().replace(/Hind: |Цена: /, ''));
      },
      'period': function period($) {
        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 1) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(3)').text().replace(/Kampaania periood: |Период кампании: /, ''));
        }

        if ($('#01 tr:nth-child(6) > td:nth-child(2) > p:not(.view_sale_date) > font').length === 2) {
          return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(4)').text().replace(/Kampaania periood: |Период кампании: /, ''));
        }

        return utils.unleakString($('#01 tr:nth-child(6) > td:nth-child(2) > p.view_sale_date:nth-child(2)').text().replace(/Kampaania periood: |Период кампании: /, ''));
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