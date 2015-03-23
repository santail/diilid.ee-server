var util = require('util'),
    AbstractParser = require("./abstractParser");

function CherryParser() {
    AbstractParser.call(this);

    this.config = {
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
}

util.inherits(CherryParser, AbstractParser);

module.exports = CherryParser;