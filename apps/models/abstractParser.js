'use strict';

var _ = require("underscore")._,
    async = require('async'),
    cheerio = require("cheerio"),
    request = require('request'),
    urlParser = require("url");

function AbstractParser() {
    this.config = {};
    this.isInPakkumised = false;
    this.db = null;
}

AbstractParser.prototype.isPakkumised = function () {
    return this.isInPakkumised;
};

AbstractParser.prototype.parseResponseBody = function (body) {
    return cheerio.load(body);
};

AbstractParser.prototype.getPagingParameters = function (body) {
    var that = this;

    console.log('Checking paging ...');

    if (that.config.paging) {
        var paging = that.config.paging.call(that, body);

        if (_.size(paging) > 0) {
            console.log('Paging found ...', paging);
            return paging;
        }
    }

    console.log('Paging not found');
    return false;
};

AbstractParser.prototype.iteratePages = function (paging, callback) {
    var that = this,
        counter = 0;

    console.log('Iterating found pages starting from', paging.first, 'till', paging.last);
    
    callback();
};

AbstractParser.prototype.getOfferLinks = function (body) {
    var that = this;
    
    return that.config.list.call(that, body);
};

AbstractParser.prototype.compileProperUrl = function (url, link) {
    return urlParser.resolve(url, link);
};

AbstractParser.prototype.getSite = function () {
    return this.config.site || '';
};

AbstractParser.prototype.setDb = function (db) {
    this.db = db;
};

AbstractParser.prototype.parseOffer = function (body, callback) {
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

    callback(_apply(cheerio.load(body), this.config.templates));
};

module.exports = AbstractParser;
