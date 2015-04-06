var config = require('./config/environment'),
  mongojs = require("mongojs"),
  async = require('async'),
  _ = require('underscore')._,
  cron = require('cron').CronJob,
  Crawler = require("./services/Crawler");

var Harvester = function () {
  this.db = null;
};

Harvester.prototype.parseOffer = function (originalUrl, parser, body, callback) {
  var that = this,
    runningTime = new Date(),
    offer = {
      'url': originalUrl,
      'site': parser.getSite(),
      'active': true
    };

  console.log('Parsing offer', originalUrl);
  parser.parseOffer(body, function (err, parsed) {
    if (!err) {
      _.extend(offer, parsed);

      _.extend(offer, {
        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
      });

      that.saveOffer(offer, function (err) {
        if (err) {
          console.log("Error saving offer", err);
        }

        if (offer.pictures) {
          that.processImages(offer.pictures, function (err) {
            if (err) {
              console.log("Error processing offers pictures", err);
            }
            callback(err, offer);
          });
        }
        else {
          callback(err, offer);
        }
      });
    }
    else {
      console.log("Error parsing offer", err);
      callback(err, offer);
    }
  });
};

Harvester.prototype.saveOffer = function (offer, callback) {
  var that = this;

  that.db.offers.save(offer, function (err, saved) {
    if (err || !saved) {
      console.log("Deal not saved", err);
      callback(err);
    }
    else {
      callback();
    }
  });
};

Harvester.prototype.processImages = function (images, callback) {
  console.log('Fetching images:', images.length);
  // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, callback);
  callback();
};

Harvester.prototype.processOffers = function (parser, language, data, callback) {
  var that = this;

  console.log("Parsing index page for offers links");

  var links = parser.getOfferLinks(data, language);

  console.log('Iterating found offers. Total found', _.size(links));

  var functions = _.map(links, function (originalUrl) {

    return function (finishOfferProcessing) {
      that.db.offers.findOne({
        url: originalUrl
      }, function (err, offer) {
        console.log('Checking offer', originalUrl);

        if (err) {
          console.log('Error checking offer by url', originalUrl);
          finishOfferProcessing(err);
          return;
        }

        if (parser.config.reactivate && offer) {
          console.log('Offer', originalUrl, 'has been already parsed. Reactivating.');
          // find one named 'mathias', tag him as a contributor and return the modified doc
          that.db.offers.findAndModify({
            query: {
              _id: offer._id
            },
            update: {
              $set: {
                active: true
              }
            },
            'new': false
          }, function (err, doc, lastErrorObject) {
            if (err) {
              console.log('Error reactivating offer #Id', offer._id);
            }

            finishOfferProcessing(err);
          });
        }
        else if (offer) {
          console.log('Offer', originalUrl, 'has been already parsed. Skipped.');
          finishOfferProcessing();
        }
        else {
          console.log('Retrieving offer', originalUrl);

          that.crawler.request(originalUrl, function (data) {
            that.parseOffer(originalUrl, parser.getValidParser(originalUrl), data, finishOfferProcessing);
          }, function (err, response) {
            console.log('Parsing offer', originalUrl, 'failed', err);
            finishOfferProcessing(err);
          });
        }
      });
    };
  });

  async.parallel(functions, function (err, links) {
    callback(err, links);
  });
};

Harvester.prototype.processPage = function (url, parser, language, finishPageProcessing) {
  var that = this;

  console.log('Requesting page', url);

  that.crawler.request(url, function (data) {
      that.processOffers(parser, language, parser.parseResponseBody(data), function (err) {
        finishPageProcessing(err);
      });
    },
    function (err, response) {
      if (err) {
        console.log('Error retrieving page for', language, url, response.statusCode, err);
      }

      finishPageProcessing(err);
    });
};

Harvester.prototype.processSite = function (parser, callback) {
  var that = this;

  var numberOfLanguages = _.size(parser.config.index),
    numberOfLanguagesProcessed = 0;

  async.forEachSeries(_.keys(parser.config.index), function (language, finishLanguageProcessing) {
    var url = parser.config.index[language];

    console.log("Retrieving index page for", language, url);

    that.crawler.request(url,
      function (data) {
        console.log("Parsing index page for", language, url);

        var body = parser.parseResponseBody(data);
        var paging = parser.getPagingParameters(language, body);

        if (paging) {
          var pages = paging.pages;

          var functions = _.map(pages, function (pageUrl) {
            return function (finishPageProcessing) {
              that.processPage(pageUrl, parser, language, function (err) {
                finishPageProcessing(err);
              });
            };
          });

          async.parallel(functions, function (err, pages) {
            callback(err, pages);
          });
        }
        else {
          that.processOffers(parser, language, body, function (err) {
            if (err) {
              console.log('Error retriving offers for', url, err);
            }
            else {
              console.log('Index page', url, 'parsed successfully');
            }

            numberOfLanguagesProcessed++;
            finishLanguageProcessing(err);
          });
        }
      },
      function (err, response) {
        console.log('Error retrieving index page for', language, url, response.statusCode, err);
        numberOfLanguagesProcessed++;
        finishLanguageProcessing(err);
      });

  }, function (err) {
    if (err) {
      callback(err);
    }
    else {
      if (numberOfLanguages === numberOfLanguagesProcessed) {
        callback();
      }
    }
  });
};

Harvester.prototype.runPakkumisedHarvesting = function () {
  var that = this;

  if (!!config.pakkumised) {
    var pageNumber = 0,
      pageRepeats = false,
      lastId = null;

    var PakkumisedParser = require(__dirname + '/models/pakkumised.ee.js'),
      parser = new PakkumisedParser();

    async.whilst(
      function () {
        return !pageRepeats;
      },
      function (finishPageProcessing) {
        pageNumber++;

        var pageUrl = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';

        that.processPage(pageUrl, parser, 'est', function (err, deals) {
          if (err) {
            console.error(err);
          }

          if (!_.isEmpty(deals) && lastId !== _.last(_.keys(deals))) {
            console.log('not a last page');

            lastId = _.last(_.keys(deals));

            console.log('processing offers on page ', pageNumber);
          }
          else {
            pageRepeats = true;
          }

          finishPageProcessing(err);
        });
      },
      function (err) {
        that.onHarvestingFinished(err);
      }
    );
  }
};

Harvester.prototype.runHarvesting = function () {
  var that = this;

  async.forEachSeries(_.keys(config.activeSites), function (site, finishSiteProcessing) {
    if (config.activeSites[site]) {
      console.log('Site', site, 'is active. Harvesting.');

      var Parser = require(__dirname + '/models/' + site + ".js"),
        parser = new Parser();

      if (parser.config.cleanup) {
        that.db.offers.remove({
          'site': site
        }, function (err) {
          if (err) {
            console.log('Error cleaning up offers for site', site, err);
            that.onSiteProcessed(err, site, finishSiteProcessing);
          }
          else {
            that.processSite(parser, function (err) {
              that.onSiteProcessed(err, site, finishSiteProcessing);
            });
          }
        });
      }

      if (parser.config.reactivate) {
        console.log('Deactivating offers for site', site);

        that.db.offers.update({
          'site': site
        }, {
          $set: {
            active: false
          }
        }, {
          'multi': true,
          'new': false
        }, function (err) {
          if (err) {
            console.log('Error deactivating offers for site', site, err);
            that.onSiteProcessed(err, site, finishSiteProcessing);
          }
          else {
            that.processSite(parser, function (err) {
              that.onSiteProcessed(err, site, finishSiteProcessing);
            });
          }
        });
      }
      else {
        that.processSite(parser, function (err) {
          that.onSiteProcessed(err, site, finishSiteProcessing);
        });
      }
    }
    else {
      console.log('Site', site, 'is switched off. Skipped.');
      finishSiteProcessing();
    }
  }, function (err) {
    that.onHarvestingFinished(err);
  });
};

Harvester.prototype.run = function () {
  var that = this,
    runningTime = new Date();

  that.db = mongojs.connect(config.db.url, config.db.collections);
  that.db.collection('offers');

  that.crawler = new Crawler();

  console.log('harvesting started', runningTime);

  that.runPakkumisedHarvesting();
  that.runHarvesting();
};

Harvester.prototype.onHarvestingFinished = function (err) {
  var that = this;

  if (err) {
    console.log('Harvesting failed', err);
  }
  else {
    console.log('Harvesting finished');
  }

  that.db.close();
};

Harvester.prototype.onSiteProcessed = function (err, site, callback) {
  if (err) {
    console.log('Error processing site', site);
  }
  else {
    console.log('Processing site', site, 'finished successfully');
  }

  callback(err);
};

Harvester.prototype.start = function (forceMode) {
  if (forceMode) {
    this.run();
  }
  else {
    new cron(config.harvester.execution.rule, this.run, null, true, "Europe/Tallinn");
  }
};

module.exports = Harvester;
