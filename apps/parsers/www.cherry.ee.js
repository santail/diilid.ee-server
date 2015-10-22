'use strict';

var util = require('util'),
    urlParser = require("url"),
    AbstractParser = require("./abstractParser");

function CherryParser() {
    AbstractParser.call(this);

    this.config = {
        'site' : 'www.cherry.ee',
        'cleanup': true,
        'reactivate': false,
        'index': {
            'rus': 'https://cherry.ee/ru/',
            'est': 'https://cherry.ee/et/'
        },
        'list': function ($) {
            return $('#themainthing div.offer-block div.row-of-deals div.offer-small div.info > h2 > a').map(function () {
                return $(this).attr('href');
            }).get();
        },
        'templates': {
            'title': function ($) {
                return $('div#deal-info h2 > a').text();
            },
            'pictures': function ($) {
                return $('#deal-image div.carousel-inner div.item a > img').map(function () {
                    return $(this).attr('src');
                }).get();
            },
            'description': {
                'intro': function ($) {
                    // TODO needs to be cleared out
                    return $('#themainthing div.offer-details div.offer-contents div.left-side div#long_text_container').html();
                },
                'long': function ($) {
                    // TODO needs to be cleared out
                    return $('#themainthing div.offer-details div.offer-contents div.left-side > ul.pink-bullets').text();
                }
            },
            'price': {
                'original': function ($) {
                    return $('div#deal-info > div.price-old').text().replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').trim();
                },
                'discount': function ($) {
                    return $('div#deal-info > div.price-big').text().replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s\s+/g, ' ').trim();
                }
            }
        }
    };
}

util.inherits(CherryParser, AbstractParser);

CherryParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

module.exports = CherryParser;