'use strict';

var expect = require('chai').expect,
  _ = require("underscore")._,
  fs = require("fs"),
  conf = require('../../apps/config/env/');

_.each(conf.activeSites, function (active, site) {
  if (active) {
    var Parser = require('../../apps/parsers/' + site + '.js');
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
                'url': url
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
