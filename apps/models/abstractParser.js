'use strict';

var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio");

function AbstractParser() {
    this.config = {};
};

AbstractParser.prototype.parse = function (body, done) {
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

    done(_apply(cheerio.load(body), this.config.templates));
};

module.exports = AbstractParser;
