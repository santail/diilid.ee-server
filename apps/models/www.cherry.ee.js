var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio");

var config = {
    'index': {
        'rus': 'https://cherry.ee/ru/',
        'est': 'https://cherry.ee/et/'
    },
    'list': function ($) {
        return $('#themainthing div.offer-block div.row-of-deals div.offer-small div.info > h2 > a').map(function () {
            return $(this).attr('href');
        });
    },
    'templates': {
        'title': function ($) {
            return $('div#deal-info h2 > a').text();
        },
        'pictures': function ($) {
            return $('#deal-image div.carousel-inner div.item a > img').map(function () {
                return $(this).attr('src');
            });
        },
        'description': {
            'short': function ($) {
                // TODO needs to be cleared out
                return $('#themainthing div.offer-details div.offer-contents div.left-side div#long_text_container').html();
            },
            'long': function ($) {
                // TODO needs to be cleared out
                return $('#themainthing div.offer-details div.offer-contents div.left-side').html();
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
