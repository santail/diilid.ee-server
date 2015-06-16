var config = require('./config/environment'),
  async = require('async'),
  _ = require('underscore')._,
  cron = require('cron').CronJob,
  Crawler = require("./services/Crawler");

var logentries = require('node-logentries');
var log = logentries.logger({
  token:'8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
});

var Harvester = function () {
  this.db = null;
};

Harvester.prototype.parseOffer = function (url, language, parser, body, callback) {
  var that = this,
    runningTime = new Date(),
    offer = {
      'url': url,
      'site': parser.getSite(),
      'active': true
    };

  log.info('Parsing offer', url, language);

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
            return callback(err, offer);
          });
        }
        else {
          return callback(err, offer);
        }
      });
    }
    else {
      log.error("Error parsing offer", err);

      return callback(err, offer);
    }
  }, language);
};

Harvester.prototype.saveOffer = function (offer, callback) {
  var that = this;

  that.db.offers.save(offer, function (err, saved) {
    if (err || !saved) {
      return callback(err);
    }
    else {
      return callback();
    }
  });
};

Harvester.prototype.processImages = function (images, callback) {
  console.log('Fetching images:', images.length);
  // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, callback);
  return callback();
};

Harvester.prototype.processOffers = function (parser, language, data, callback) {
  var that = this;

  log.info("Parsing page for offers links for " + language);

  var links = parser.getOfferLinks(data, language);

  console.log('Iterating found offers. Total found ' + _.size(links));

  var functions = _.map(links, function (url) {
    return function (finishOfferProcessing) {
      log.info('Checking offer ' + url);

      that.db.offers.findOne({
        url: url
      }, function (err, offer) {
        if (err) {
          console.log('Error checking offer by url', url);
          finishOfferProcessing(err);
          return;
        }

        if (parser.config.reactivate && offer) {
          that.reactivateOffer(offer, finishOfferProcessing);
        }
        else if (offer) {
          console.log('Offer', url, 'has been already parsed. Skipped.');
          finishOfferProcessing();
        }
        else {
          console.log('Retrieving offer', url);

          that.crawler.request(url, function (data) {
            that.parseOffer(url, language, parser.getValidParser(url), data, finishOfferProcessing);
          }, function (err, response) {
            console.log('Parsing offer', url, 'failed', err);
            finishOfferProcessing(err);
          });
        }
      });
    };
  });

  async.parallel(functions, function (err, links) {
    return callback(err, links);
  });
};

Harvester.prototype.reactivateOffer = function (offer, callback) {
  var that = this;

  console.log('Offer #Id', offer._id, ':', offer.url, 'has been already parsed. Reactivating.');

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

    return callback(err);
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

  console.log('Processing site', parser.getSite());

  var numberOfLanguages = _.size(parser.config.index),
    numberOfLanguagesProcessed = 0;

  async.forEachSeries(_.keys(parser.config.index), function (language, finishLanguageProcessing) {
    var url = parser.config.index[language];

    console.log("Retrieving index page for", language, url);

    that.crawler.request(url, function (data) {
      console.log("Parsing index page for", language, url);

      var body = parser.parseResponseBody(data);
      var paging = parser.getPagingParameters(language, body);

      if (paging) {
        var pages = paging.pages;

        console.log('Paging found. Processing in parallel', _.size(pages), 'pages');

        var functions = _.map(pages, function (pageUrl) {
          return function (finishPageProcessing) {
            that.processPage(pageUrl, parser, language, function (err) {
              finishPageProcessing(err);
            });
          };
        });

        async.parallel(functions, function (err) {
          numberOfLanguagesProcessed++;
          finishLanguageProcessing(err);
        });
      }
      else {
        console.log('Paging not found.');

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
      return callback(err);
    }
    else {
      if (numberOfLanguages === numberOfLanguagesProcessed) {
        return callback();
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

Harvester.prototype.cleanupOffersBefore = function (parser, callback) {
  var that = this;

  console.log('Cleaning up all offers for site', parser.getSite());

  that.db.offers.remove({
    'site': parser.getSite()
  }, function (err) {
    if (err) {
      console.log('Error cleaning up offers for site', parser.getSite(), err);
      that.onSiteProcessed(err, parser.getSite(), callback);
    }
    else {
      console.log('Offers for site', parser.getSite(), 'removed');

      that.processSite(parser, function (err) {
        that.onSiteProcessed(err, parser.getSite(), callback);
      });
    }
  });
};

Harvester.prototype.deactivateOffersBefore = function (parser, callback) {
  var that = this;

  console.log('Deactivating offers for site', parser.getSite());

  that.db.offers.update({
    'site': parser.getSite()
  }, {
    $set: {
      active: false
    }
  }, {
    'multi': true,
    'new': false
  }, function (err) {
    if (err) {
      console.log('Error deactivating offers for site', parser.getSite(), err);
      that.onSiteProcessed(err, parser.getSite(), callback);
    }
    else {
      console.log('Offers for site', parser.getSite(), 'deactivated');

      that.processSite(parser, function (err) {
        that.onSiteProcessed(err, parser.getSite(), callback);
      });
    }
  });
};

Harvester.prototype.runHarvesting = function () {
  var that = this,
    runningTime = new Date();

  console.log('Harvesting started', runningTime);

  var numberOfSites = _.size(config.activeSites),
    numberOfSitesProcessed = 0;

  async.forEachSeries(_.keys(config.activeSites), function (site, finishSiteProcessing) {
    var onSiteProcessedCallback = function (err) {
      numberOfSitesProcessed++;
      finishSiteProcessing(err);
    };

    if (config.activeSites[site]) {
      console.log('Site', site, 'is active. Harvesting.');

      var Parser = require(__dirname + '/models/' + site + ".js"),
        parser = new Parser();

      if (parser.config.cleanup) {
        that.cleanupOffersBefore(parser, onSiteProcessedCallback);
      }
      else if (parser.config.reactivate) {
        that.deactivateOffersBefore(parser, onSiteProcessedCallback);
      }
      else {
        that.processSite(parser, function (err) {
          that.onSiteProcessed(err, parser.getSite(), onSiteProcessedCallback);
        });
      }
    }
    else {
      console.log('Site', site, 'is switched off. Skipped.');
      onSiteProcessedCallback();
    }
  }, function (err) {
    if (err) {
      that.onHarvestingFinished(err);
    }
    else {
      if (numberOfSites === numberOfSitesProcessed) {
        that.onHarvestingFinished(err);
      }
    }
  });
};

Harvester.prototype.onHarvestingFinished = function (err) {
  if (err) {
    log.log('error', {'message': 'Harvesting failed', 'error': err});
  }
  else {
    log.info('Harvesting finished');
  }

  this.db.close();
};

Harvester.prototype.onSiteProcessed = function (err, site, callback) {
  if (err) {
    log.log('error', {'message': 'Error processing site ' + site, 'error': err});
  }
  else {
    console.log('Processing site', site, 'finished successfully');
  }

  return callback(err);
};

Harvester.prototype.run = function () {
  var that = this;

  log.info('Initiating Harvester\' run');

  that.db = require('mongojs').connect(config.db.uri, config.db.collections);
  that.db.collection('offers');
  that.crawler = new Crawler();

  that.runPakkumisedHarvesting();
  that.runHarvesting();
};

Harvester.prototype.start = function (forceMode) {
  var that = this;

  if (forceMode) {
    that.run();
  }
  else {
    new cron(config.harvester.execution.rule, that.run.bind(that), null, true, "Europe/Tallinn");
  }
};

module.exports = Harvester;
