var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio");

var config = {
    'index': {
        'rus': 'http://www.euronics.ee/products/c/143',
        'est': 'http://www.euronics.ee/tooted/c/143',
        'eng': 'http://www.euronics.ee/products-en/c/143'
    },
    'paging' : function ($) {
        var pagination = $('#p_Content_s3378_uxSegmentPagin ol li.page');

        return {
          'first': _.first(pagination).text(),
          'last': _.last(pagination).text()
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
