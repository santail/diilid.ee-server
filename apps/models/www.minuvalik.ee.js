var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio");

var config = {
    'index': {
        'rus': 'https://www.minuvalik.ee/ru/',
        'est': 'https://www.minuvalik.ee/'
    },
    'list': function ($) {
        return $('#ddws > a').map(function () {
            return $(this).attr('href');
        });
    },
    'templates': {
        'title': function ($) {
            return $('div.basic_bkgr div.dd_title > span').html();
        },
        'pictures': function ($) {
            return $('div.basic_1050 div.dd_photo.mt10 > a').map(function () {
                return $(this).attr('href');
            });
        },
        'description': {
            'short': function ($) {
                return $('div.basic_1050 div.dd_lead').html();
            },
            'long': function ($) {
                return $('div.basic_1050 ul.dd_descr').html();
            }
        }
    }
};

module.exports.parse = function (body, done) {
    console.log('parsing ...');


    var _apply = function apply(body, templates) {
        var result = {};

        async.forEachSeries(_.keys(templates), function (template, finishItemProcessing) {
            if (typeof templates[template] === 'object') {
                result[template] = apply(body, templates[template]);
            }
            else if (typeof templates[template] === 'function') {
                var value = templates[template].call(this, body);
                result[template] = typeof value === "string" ? value.trim().replace(/\t/g, ' ').replace(/\s\s+/g, ' ') : value;
            }

            finishItemProcessing();
        });

        return result;
    };

    done(_apply(cheerio.load(body), config.templates));
};
