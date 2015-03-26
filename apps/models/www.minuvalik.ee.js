'use strict';

var util = require('util'),
    urlParser = require("url"),
    AbstractParser = require("./abstractParser");

function MinuvalikParser() {
    AbstractParser.call(this);

    this.config = {
        'site': 'www.minuvalik.ee',
        'index': {
            'rus': 'https://www.minuvalik.ee/ru/?c=all',
            'est': 'https://www.minuvalik.ee/?c=all'
        },
        'list': function ($) {
            return $('div.deals li > a').map(function () {
                return $(this).attr('href');
            });
        },
        'templates': {
            'title': function ($) {
                return $('.deal_rules_td > h1.title_deal').text();
            },
            'pictures': function ($) {
                return $('.deal_rules_td .dd_video_photo > a').map(function () {
                    return $(this).attr('href');
                });
            },
            'description': {
                'short': function ($) {
                    return $('.deal_rules_td .dd_descr').first().html();
                },
                'long': function ($) {
                    return $($('.deal_rules_td .dd_descr')[1]).html();
                }
            }
        }
    };
}

AbstractParser.prototype.compileOfferUrl = function (language, link) {
    var that = this;

    return urlParser.resolve(that.config.index[language], link);
};

util.inherits(MinuvalikParser, AbstractParser);

module.exports = MinuvalikParser;
