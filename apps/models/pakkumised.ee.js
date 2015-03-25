'use strict';

var util = require('util'),
    AbstractParser = require("./abstractParser");

function PakkumisedParser() {
    AbstractParser.call(this);

    this.config = {
        'index': {
            'est': 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page='
        },
        'list': function ($) {

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
}

PakkumisedParser.prototype.parseResponseBody = function (data) {
    return JSON.parse(data);
};

util.inherits(PakkumisedParser, AbstractParser);

module.exports = PakkumisedParser;