'use strict';

var expect = require('chai').expect,
  _ = require("underscore")._,
  fs = require("fs"),
  Parser = require('../../apps/parsers/www.kriisis.ee.js');

var urls = {
  'offer': {
    'est': 'http://www.kriisis.ee/view_sale.php?id=654249',
    'rus': 'http://www.kriisis.ee/ru/view_sale.php?id=654249'
  }
};

var parser = new Parser();

describe(parser.config.site, function () {

  describe("Layout has not been changed", function () {

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