'use strict';

var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio"),
    tidy = require('htmltidy').tidy;

function AbstractParser() {
    this.config = {};
    this.isInPakkumised = false;
    this.db = null;
}

AbstractParser.prototype.isPakkumised = function () {
    return this.isInPakkumised;
};

AbstractParser.prototype.parseResponseBody = function (body) {
    return cheerio.load(body, {
        normalizeWhitespace: true,
        xmlMode: true,
        decodeEntities: true
    });
};

AbstractParser.prototype.getPagingParameters = function (language, body) {
    var that = this;

    console.log('Checking paging ...');

    if (that.config.paging) {
        var paging = that.config.paging.call(that, language, body);

        if (_.size(paging) > 0) {
            console.log('Paging found ...', paging);
            return paging;
        }
    }

    return false;
};

AbstractParser.prototype.getValidParser = function (url) {
    return this;
};

AbstractParser.prototype.getOfferLinks = function (data, language) {
    var that = this;

    var links = that.config.list.call(that, data, language);

    return _.map(links, function (link) {
        return that.compileOfferUrl(language, link);
    });
};

AbstractParser.prototype.compileImageUrl = function (language, link) {
    return link;
};

AbstractParser.prototype.compilePageUrl = function (language, link) {
    return link;
};

AbstractParser.prototype.compileOfferUrl = function (language, link) {
    return link;
};

AbstractParser.prototype.getSite = function () {
    return this.config.site || '';
};

AbstractParser.prototype.setDb = function (db) {
    this.db = db;
};

AbstractParser.prototype.parseOffer = function (body, callback, language) {
    var that = this,
        language = language || 'est';

    var _apply = function apply(body, templates, language) {
        var result = {};

        async.forEachSeries(_.keys(templates), function (template, finishItemProcessing) {
            if (typeof templates[template] === 'object') {
                result[template] = apply(body, templates[template], language);
            }
            else if (typeof templates[template] === 'function') {
                var value = templates[template].call(this, body, language);
                result[template] = typeof value === "string" ? value.trim().replace(/\t/g, ' ').replace(/\s\s+/g, ' ') : value;
            }

            finishItemProcessing();
        });

        return result;
    };

    // TODO Warning: tidy uses 32 bit binary instead of 64, https://github.com/vavere/htmltidy/issues/11
    // TODO Needs manual update on production for libs
    tidy(body, {
        'doctype': 'html5',
        'tidy-mark': false,
        'indent': true
    }, function (err, body) {
        if (!err) {
            var offer = _apply(cheerio.load(body), that.config.templates, language);

            _.extend(offer, {
                'language': language
            });

            callback(err, offer);
        }
        else {
            callback(err);
        }
    });
};

module.exports = AbstractParser;
