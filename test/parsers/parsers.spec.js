'use strict';

var expect = require('chai').expect,
  _ = require("underscore")._,
  fs = require("fs");

var sites = {
  'www.pakkumised.ee': false,
  'www.e-maxima.ee': true,
  'www.chilli.ee': true,
  'www.euronics.ee': true,
  'www.euronics.discount.ee': true,
  'www.euronics.outlet.ee': true,
  'www.expert.discount.ee': true,
  'www.expert.outlet.ee': true,
  'www.expert.top.ee': true,
  'www.k-rauta.ee': true,
  'www.kriisis.ee': true,
  'www.minuvalik.ee': true,
  'www.onoff.ee': true,
  'www.onoff.eshop.ee': true,
  'www.prismamarket.ee': true,
  'www.selver.ee': true
};

_.each(sites, function (active, site) {
  if (active) {
    var Parser = require('../../apps/parsers/' + site + '.js');

    Parser.prototype.processOffers = function (language, offers, processOffer, done) {
      expect(offers).to.not.be.empty;

      done();
    };

    Parser.prototype.processPage = function (url, language, processOffer, callback) {
      callback(null, {"totalPages": 1 });
    };


    var parser = new Parser();

    describe(parser.config.site, function () {

      var data = JSON.parse(fs.readFileSync(__dirname + '/' + parser.config.site + '.data.json', 'utf8'));

      _.each(data.offers, function (urls, language) {

        describe(language, function () {

          _.each(data.offers[language], function (data, url) {
            it(language + " Offer layout has not been changed for offer " + url, function (done) {
              var event = {
                'id': 1,
                'site': parser.config.site,
                'language': parser.languages[language],
                'url': url,
                'test': true
              };

              parser.fetchOffer(event, function (err, res) {
                expect(res).to.not.be.empty;

                var runningTime = new Date();

                data.site = event.site;
                data.active = true;
                data.id = event.id;
                data.url = event.url;
                data.language = event.language;
                data.parsed = runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear();

                expect(err).to.be.null;
                expect(res).to.not.be.empty;
                expect(data).to.deep.equal(res);
                done();
              });
            });
          });
        });
      });
    });
  }
});
