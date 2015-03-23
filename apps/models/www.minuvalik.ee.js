var util = require('util'),
    AbstractParser = require("./abstractParser");

function MinuvalikParser() {
    AbstractParser.call(this);

    this.config = {
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

util.inherits(MinuvalikParser, AbstractParser);

module.exports = MinuvalikParser;
