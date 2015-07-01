'use strict';

var expect = require('chai').expect,
  _ = require("underscore")._,
  fs = require("fs"),
  Parser = require('../../apps/parsers/www.chilli.ee.js');

var urls = {
  'offer': {
    'est': 'http://www.chilli.ee/vaata-pakkumist/nordiccake-rikkaliku-taidisega-kringlid-54',
    'rus': 'http://ru.chilli.ee/vaata-pakkumist/nordiccake-rikkaliku-taidisega-kringlid-54'
  }
};

var parser = new Parser();

describe(parser.config.site, function () {

  describe("Layout has not been changed", function () {

    /*
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
    */

    _.each(_.keys(parser.config.index), function (language) {
      it("Parsing offer's page for " + language + " should return proper data", function (done) {
        var offerDataFile = __dirname + '/' + parser.config.site + '.data.' + language + '.json',
          offerBodyFile = __dirname + '/' + parser.config.site + '.offer.' + language + '.html';

          var data = JSON.parse(fs.readFileSync(offerDataFile, 'utf8'));

          fs.readFile(offerBodyFile, 'utf8', function (err, body) {
            if (!err) {
              parser.parseOffer(body, language, function (err, res) {
                expect(err).to.be.empty;
                expect(res).to.not.be.empty;
                expect(data).to.deep.equal(res);
                done();
              });
            }
          });
      });
    });
  });
});