var config = require('./config/environment'),
  async = require('async'),
  _ = require('underscore')._,
  cron = require('cron').CronJob,
  Crawler = require("./services/Crawler"),
  LOG = require("./services/Logger");

var Harvester = function () {
  this.db = null;
};

Harvester.prototype.start = function (forceMode) {
  var that = this;

  if (forceMode) {
    LOG.info('Running in force mode. No recurring.');
    that.run();
  }
  else {
    LOG.info('Running in reccuring mode.', config.harvester.execution.rule);
    new cron(config.harvester.execution.rule, that.run.bind(that), null, true, "Europe/Tallinn");
  }
};

Harvester.prototype.run = function () {
  var that = this;

  LOG.info('Running harvesting');

  LOG.info('Connecting to database', config.db.uri);

  that.db = require('mongojs').connect(config.db.uri, config.db.collections);

  LOG.info('Switch to offers schema');
  that.db.collection('offers');

  that.crawler = new Crawler();

  that.runPakkumisedHarvesting();
  that.runHarvesting();
};

Harvester.prototype.runPakkumisedHarvesting = function () {
  var that = this;

  LOG.info('Harvesting Pakkumised.ee');

  if (!!config.pakkumised) {
    var pageNumber = 0,
      pageRepeats = false,
      lastId = null;

    var PakkumisedParser = require(__dirname + '/parsers/pakkumised.ee.js'),
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

  LOG.info('Harvesting preconfigured sources');

  var numberOfSites = _.size(config.activeSites),
    numberOfSitesProcessed = 0;

  LOG.info('Total sites available', numberOfSites, config.activeSites);
  LOG.info('Processing sites');

  async.forEachSeries(_.keys(config.activeSites), function (site, finishSiteProcessing) {
    LOG.info('Processing site', site);

    var onSiteProcessedCallback = function (err) {
      numberOfSitesProcessed++;
      return finishSiteProcessing(err);
    };

    if (config.activeSites[site]) {
      LOG.info('Site', site, 'is active. Continue.');

      var Parser = require(__dirname + '/parsers/' + site + ".js"),
        parser = new Parser();

      LOG.info('Parser', parser.config.site, 'used. Checking configuration.');

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
      LOG.info('Site', site, 'is not active. Skipped.');

      return onSiteProcessedCallback();
    }
  }, function (err) {
    if (err) {
      return that.onHarvestingFinished(err);
    }
    else {
      if (numberOfSites === numberOfSitesProcessed) {
        return that.onHarvestingFinished(err);
      }
    }
  });
};

Harvester.prototype.cleanupOffersBefore = function (parser, callback) {
  var that = this,
    site = parser.getSite();

  LOG.info('Remove excisting offers for site', site, 'and read fresh data');

  that.db.offers.remove({
    'site': parser.getSite()
  }, function (err) {
    if (err) {
      LOG.error({
        'message': 'Error deleting offers for site ' + site,
        'error': err
      });

      return that.onSiteProcessed(err, site, callback);
    }
    else {
      LOG.info('Offers for site', site, 'deleted');

      return that.processSite(parser, function (err) {
        return that.onSiteProcessed(err, site, callback);
      });
    }
  });
};

Harvester.prototype.deactivateOffersBefore = function (parser, callback) {
  var that = this,
      site = parser.getSite();

  LOG.info('Deactivating excisting offers for site', site, 'and read fresh data');

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
      LOG.error({
        'message': 'Error deleting deactivating for site ' + site,
        'error': err
      });

      return that.onSiteProcessed(err, site, callback);
    }
    else {
      LOG.info('Offers for site', site, 'deactivated');

      return that.processSite(parser, function (err) {
        return that.onSiteProcessed(err, site, callback);
      });
    }
  });
};

Harvester.prototype.processSite = function (parser, callback) {
  var that = this,
      site = parser.getSite(),
      languages = _.keys(parser.config.index),
      numberOfLanguages = _.size(languages),
      numberOfLanguagesProcessed = 0;

  LOG.info('Processing', site, 'gathering fresh data');
  LOG.info('Site', site, 'has', numberOfLanguages, 'languages', languages);

  async.forEachSeries(languages, function (language, finishLanguageProcessing) {
    var url = parser.config.index[language];

    LOG.info("Retrieving index page for", site, 'language', language, ':', url);

    that.crawler.request(url, function (err, data, response) {
      if (err) {
        LOG.error({
          'message': 'Error retrieving index page for ' + site + 'language ' + language + ': ' + url,
          'statusCode': response.statusCode,
          'error': err
        });

        numberOfLanguagesProcessed++;
        return finishLanguageProcessing(err);
      }

      LOG.info("Parsing index page for", site, 'language', language, ':', url);

      var body = parser.parseResponseBody(data);
      var paging = parser.getPagingParameters(language, body);

      if (paging) {
        var pages = paging.pages,
            pagesNumber = _.size(pages);

        var functions = _.map(pages, function (pageUrl, index) {
          return function (finishPageProcessing) {
            LOG.info('Processing page', index + 1, 'from', pagesNumber);

            return that.processPage(pageUrl, parser, language, function (err) {
              return finishPageProcessing(err);
            });
          };
        });

        LOG.info('Parsing pages for', site, 'language', language, ':', url);

        async.parallel(functions, function (err) {
          numberOfLanguagesProcessed++;
          return finishLanguageProcessing(err);
        });
      }
      else {
        that.processOffers(parser, language, body, function (err) {
          if (err) {
            LOG.error({
              'message': 'Error processing offers for ' + site + 'language ' + language + ': ' + url,
              'error': err
            });
          }
          else {
            LOG.info('Index page for', site, 'language', language , ':', url, 'parsed successfully');
          }

          numberOfLanguagesProcessed++;
          return finishLanguageProcessing(err);
        });
      }
    });
  }, function (err) {
    if (err) {
      LOG.error({
        'message': 'Error processing site ' + site,
        'error': err
      });

      return callback(err);
    }
    else {
      if (numberOfLanguages === numberOfLanguagesProcessed) {
        LOG.info('Site', site, 'processed successfully');

        return callback();
      }
    }
  });
};

Harvester.prototype.processPage = function (url, parser, language, finishPageProcessing) {
  var that = this,
      site = parser.getSite();

  LOG.info('Requesting page for', site, 'language', language, ':', url);

  that.crawler.request(url, function (err, data, response) {
      if (err) {
        LOG.error({
          'message': 'Error retrieving page for ' + site + ' language ' + language + ': ' + url,
          'statusCode': response.statusCode,
          'error': err
        });

        return finishPageProcessing(err);
      }

      LOG.info('Parsing page to get offers links for ' + site + ' language ' + language + ': ' + url);

      that.processOffers(parser, language, parser.parseResponseBody(data), function (err) {
        return finishPageProcessing(err);
      });
    });
};

Harvester.prototype.processOffers = function (parser, language, data, callback) {
  var that = this,
      site = parser.getSite();

  var links = parser.getOfferLinks(data, language),
      linksNumber = _.size(links);

  LOG.info('Total links found on page', linksNumber);

  var functions = _.map(links, function (url, index) {
    return function (finishOfferProcessing) {
      LOG.info('Checking offer', index + 1, 'of', linksNumber, url);

      that.db.offers.findOne({
        url: url
      }, function (err, offer) {
        if (err) {
          LOG.error({
            'message': 'Error checking offer by url ' + url,
            'error': err
          });

          return finishOfferProcessing(err);
        }

        if (parser.config.reactivate && offer) {
          that.reactivateOffer(offer, finishOfferProcessing);
        }
        else if (offer) {
          LOG.info('Offer', url, 'has been already parsed. Skipped.');

          return finishOfferProcessing();
        }
        else {
          LOG.info('Retrieving offer for', site, 'language', language, ':', url);

          that.crawler.request(url, function (err, data, response) {
            if (err) {
              LOG.error({
                'message': 'Error retrieving offer for ' + site + 'language ' + language + ': ' + url,
                'statusCode': response.statusCode,
                'error': err
              });

              return finishOfferProcessing(err);
            }

            that.parseOffer(url, language, parser.getValidParser(url), data, finishOfferProcessing);
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

  LOG.info('Offer #Id', offer._id, offer.url, 'has been already parsed. Reactivating.');

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
      LOG.error({
        'message': 'Error reactivating offer #Id ' + offer._id,
        'error': err
      });
    }

    return callback(err);
  });
};

Harvester.prototype.parseOffer = function (url, language, parser, body, callback) {
  var that = this,
    site = parser.getSite(),
    runningTime = new Date(),
    offer = {
      'url': url,
      'site': parser.getSite(),
      'active': true
    };

  LOG.info('Parsing offer for ' + site + ' language ' + language + ': ' + url);

  parser.parseOffer(body, function (err, parsed) {
    if (err) {
      LOG.error({
        'message': 'Error retrieving offer for ' + site + ' language ' + language + ': ' + url,
        'error': err
      });

      return callback(err, offer);
    }
    else {
      _.extend(offer, parsed);

      _.extend(offer, {
        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
      });

      that.saveOffer(offer, function (err) {
        if (err) {
          LOG.error({
            'message': 'Error saving parsed offer ' + url,
            'error': err
          });

          return callback(err, offer);
        }

        that.postprocessOffer(offer, function (err) {
          return callback(err, offer);
        });
      });
    }

  }, language);
};

Harvester.prototype.saveOffer = function (offer, callback) {
  var that = this;

  LOG.debug('Saving offer', offer);

  that.db.offers.save(offer, function (err, saved) {
    if (err) {
      LOG.error({
        'message': 'Error saving offer ' + offer.url,
        'error': err
      });

      return callback(err);
    }

    if (!saved) {
      LOG.error({
        'message': 'Offer not saved ' + offer.url,
        'error': new Error('Offer not saved')
      });

      return callback(err);
    }

    LOG.info('Offer', offer.url, 'saved with id ' + offer._id);

    return callback(err);
  });
};

Harvester.prototype.postprocessOffer = function (offer, callback) {
  var that = this;

  if (offer.pictures) {
    that.processImages(offer.pictures, function (err) {
      if (err) {
        return callback(err, offer);
      }

      return callback(null, offer);
    });
  }
  else {
    return callback(null, offer);
  }
};

Harvester.prototype.processImages = function (images, callback) {
  LOG.debug('Fetching images:', images.length);
  // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, callback);
  return callback();
};

Harvester.prototype.onSiteProcessed = function (err, site, callback) {
  if (err) {
    LOG.error({
      'message': 'Error processing site ' + site,
      'error': err
    });
  }
  else {
    LOG.info(site, 'processed successfully');
  }

  return callback(err);
};

Harvester.prototype.onHarvestingFinished = function (err) {
  if (err) {
    LOG.error({
      'message': 'Harvesting failed',
      'error': err
    });
  }
  else {
    LOG.info('Harvesting finished');
  }

  this.db.close();
};

module.exports = Harvester;
