'use strict';

var _ = require("underscore")._,
    util = require('util'),
    AbstractParser = require("./abstractParser");

function EuronicsParser() {
    AbstractParser.call(this);

    this.config = {
        'site': 'www.euronics.ee',
        'index': {
            'rus': 'http://www.euronics.ee/products/c/143',
            'est': 'http://www.euronics.ee/tooted/c/143',
            'eng': 'http://www.euronics.ee/products-en/c/143'
        },
        'paging': function ($) {
            var pagination = $('div.oi-pagination ol li.page');

            return {
                'first': pagination.first().text(),
                'last': pagination.last().text()
            };
        },
        'list': function ($) {
            return $("#aspnetForm ul.oi-list.oi-grid-products > li > div > h2.name > a").map(function () {
                return $(this).attr('href');
            });
        },
        'templates': {
            'title': function ($) {
                return [];
            },
            'pictures': function ($) {
                return [];
            },
            'description': {
                'short': function ($) {
                    return [];
                },
                'long': function ($) {
                    return [];
                }
            }
        }
    };
}

util.inherits(EuronicsParser, AbstractParser);

module.exports = EuronicsParser;