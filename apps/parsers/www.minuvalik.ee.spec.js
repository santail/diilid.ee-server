'use strict';

var chai = require('chai'),
    expect = chai.expect,
    _ = require("underscore")._,
    fs = require("fs"),
    sanitizer = require("sanitizer"),
    ZizuParser = require('../../lib/parsers/ZizuParser');

var parser = new ZizuParser();

describe(parser.name, function () {

    describe('check service is running', function () {

        it("Services should be available by urls " + parser.urls.rus + ', ' + parser.urls.est, function (done) {
            parser.checkAlive({}, function (res) {
                expect(res.success).to.be.true;
                done();
            });
        });

        it("Fake service URL should be not available", function (done) {
            parser.urls['fake'] = 'somefake.url';

            parser.checkAlive({}, function (res) {
                expect(res.success).to.be.false;
                expect(res.error).to.not.be.empty;
                done();
            });
        });

    });

    describe("Layout has not been changed", function () {
        var parser = new ZizuParser();

        it("Parsing live index page should return at least some none empty deals", function (done) {
            parser.checkIndexLayoutChanged({}, function (res) {
                console.log(res);
                expect(res.changed).to.be.false;
                done();
            });
        });

        it("Parsed live deal page should match with ethalon data", function () {
            _.each(parser.sampleDealUrls, function (url, language) {
                parser.checkDealLayoutChanged(data, {}, function (res) {
                    expect(res).to.not.be.empty;
                });
            });
        });

        it("Parsing ethalon index page should return exact the same data as ethalon index page", function (done) {
            fs.readFile((__dirname + '/../sources/' + parser.site + '-' + language + '-index.html', 'utf8') + '', function (err, data) {
                if (!err) {
                    parser.fetchIndexList(data, {}, function (res) {
                        expect(res).to.not.be.empty;
                        done();
                    });
                }
            });
        });

        it("Parsing ethalon deal page should return exact same data as ethalon deal", function (done) {
            var language = 'rus';
            
            fs.readFile((__dirname + '/../sources/' + parser.site + '-' + language + '-deal.html', 'utf8') + '', function (err, data) {
                if (!err) {
                    parser.parseDeal(data, {}, function (res) {
                        expect(res).to.not.be.empty;
                        done();
                    });
                }
            });
        });
    });
});