'use strict';

var util = require('util'),
    urlParser = require("url"),
    AbstractParser = require("./abstractParser");

function OnoffParser() {
    AbstractParser.call(this);

    var that = this;

    this.config = {
        'site': 'www.onoff.ee',
        'index': {
            'rus': 'http://www.onoff.ee/font-colorb00000predlozenija-mesjatsafont/#&price=0-1400&onpage=9999&list=1',
            'est': 'http://www.onoff.ee/font-colorb00000kuupakkumisedfont/#&price=0-1400&onpage=9999&list=1',
            'eng': 'http://www.onoff.ee/font-colorb00000monthly-offersfont-eng/#&price=0-1400&onpage=9999&list=1'
        },
        'list': function ($) {
            return $('#itemsBox_560 > li > a').map(function () {
                return $(this).attr('href');
            });
        },
        'templates': {
            'title': function ($) {
                return $('#contentBox > div.pageTitle').text();
            },
            'pictures': function ($, language) {
                return $('#contentBox > div.content.catalog > ul.shopProdInfoBox div.shopProdImgBox > a').map(function () {
                    return that.compileImageUrl(language, $(this).attr('href'));
                });
            },
            'description': {
                'short': function ($) {
                     return  $('#contentBox > div.content.catalog > ul.shopProdInfoBox div.shopProdText table').html();
                },
                'long': function ($) {
                    return $('#contentBox > div.content.catalog > ul.shopProdInfoBox div.shopProdBoxContent').text();
                }
            },
            'price': {
              'original': function ($) {
                var container = $('#contentBox > div.content.catalog > ul.shopProdInfoBox div.shopProdText > form').first();

                container.children('input').remove();
                container.children('span').remove();
                container.children('div').remove();
                container.children('a').remove();

                return container.text();
              },
              'discount': function ($) {
                return $('#contentBox > div.content.catalog > ul.shopProdInfoBox div.shopProdDisc').text();
              }
            }
        }
    };
}

util.inherits(OnoffParser, AbstractParser);

OnoffParser.prototype.compileImageUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};

OnoffParser.prototype.compileOfferUrl = function (language, link) {
  var that = this;
  return urlParser.resolve(that.config.index[language], link);
};


module.exports = OnoffParser;