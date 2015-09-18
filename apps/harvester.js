var config = require('./config/environment'),
  async = require('async'),
  _ = require('underscore')._,
  Agenda = require("agenda"),
  LOG = require("./services/Logger"),
  request = require('request'),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
  utils = require("./services/Utils"),
  ParserFactory = require("./services/ParserFactory");

var hd;
memwatch.on('leak', function (info) {
  console.error(info);

  var file;

  if (!hd) {
    hd = new memwatch.HeapDiff();
    file = process.pid + '-' + Date.now() + '.heapsnapshot';
    heapdump.writeSnapshot(file, function (err) {
      if (err) console.error(err);
      else console.error('Wrote snapshot: ' + file);
    });
  }
  else {
    var diff = hd.end();
    console.log(util.inspect(diff, {
      showHidden: true,
      depth: null,
      colors: true
    }));
    hd = null;

    file = process.pid + '-' + Date.now() + '.heapsnapshot';
    heapdump.writeSnapshot(file, function (err) {
      if (err) console.error(err);
      else console.error('Wrote snapshot: ' + file);
    });
  }
});

var parserFactory = new ParserFactory();

var Harvester = function () {
  this.db = null;
};

Harvester.prototype.start = function (forceMode) {
  var that = this;

  if (forceMode) {
    LOG.info('Running in force mode. No recurring.');
    return that.run(function () {});
  }
  else {
    LOG.info('Running in reccuring mode.', config.harvester.execution.rule);

    var agenda = new Agenda({
      db: {
        address: config.db.uri
      },
      defaultLockLifetime: 10000
    });

    agenda.define('execute harvester', function (job, done) {
      try {
        return that.run(done);
      }
      catch (ex) {
        LOG.error({
          'message': 'Error running harvester',
          'error': ex.message
        });

        done();
      }
    });

    agenda.every(config.harvester.execution.rule, 'execute harvester');

    agenda.start();
  }
};

Harvester.prototype.run = function (callback) {
  var that = this;

  LOG.debug('Connecting to database', config.db.uri);

  var mongojs = require('mongojs');
  that.db = mongojs(config.db.uri, config.db.collections);

  LOG.debug('Switch to offers schema');
  that.db.collection('offers');

  async.series([
      function (done) {
        that.runPakkumisedHarvesting(done);
      },
      function (done) {
        that.runHarvesting(done);
      }
    ],
    function (err, result) {
      if (err) {
        LOG.error({
          'message': 'Error completing run',
          'err': err.message
        });
      }

      that.db.close();
      
      callback(err);
    });
};

Harvester.prototype.runPakkumisedHarvesting = function (callback) {
  var that = this;

  LOG.info('Harvesting Pakkumised.ee');

  if (!!config.pakkumised) {
    var pageNumber = 0,
      pageRepeats = false,
      lastId = null;

    var parser = parserFactory.getPakkumisedParser();

    async.whilst(
      function () {
        return !pageRepeats;
      },
      function (finishPageProcessing) {
        pageNumber++;

        var pageUrl = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';

        that.processPage(pageUrl, parser, 'est', utils.createSingleUseCallback(function (err, deals) {
          if (err) {
            LOG.error({
              'message': 'Error processing page from pakkumised.ee ' + pageUrl,
              'error': err.message
            });
          }

          if (!_.isEmpty(deals) && lastId !== _.last(_.keys(deals))) {
            lastId = _.last(_.keys(deals));
          }
          else {
            pageRepeats = true;
          }

          return finishPageProcessing(err);
        }));
      },
      function (err) {
        return that.onHarvestingFinished(err, callback);
      }
    );
  }
  else {
    callback(null, 'OK');
  }

  return true;
};

Harvester.prototype.runHarvesting = function (callback) {
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

      var parser = parserFactory.getParser(site);

      LOG.info('Parser', parser.config.site, 'used. Checking configuration.');

      if (parser.config.cleanup) {
        that.cleanupOffersBefore(parser, onSiteProcessedCallback);
      }
      else if (parser.config.reactivate) {
        that.deactivateOffersBefore(parser, onSiteProcessedCallback);
      }
      else {
        that.processSite(parser, function (err) {
          that.onSiteProcessed(err, onSiteProcessedCallback);
        });
      }
    }
    else {
      LOG.info('Site', site, 'is not active. Skipped.');

      return onSiteProcessedCallback();
    }
  }, function (err) {
    if (err) {
      return that.onHarvestingFinished(err, callback);
    }
    else {
      if (numberOfSites === numberOfSitesProcessed) {
        return that.onHarvestingFinished(err, callback);
      }
    }
  });

  return true;
};

Harvester.prototype.cleanupOffersBefore = function (parser, callback) {
  var that = this,
    site = parser.getSite();

  LOG.info('Remove excisting offers for site', site, 'and read fresh data');

  that.db.offers.remove({
    'site': parser.getSite()
  }, utils.createSingleUseCallback(function (err) {
    if (err) {
      LOG.error({
        'message': 'Error deleting offers for site ' + site,
        'error': err.message
      });

      return that.onSiteProcessed(err, callback);
    }
    else {
      LOG.info('Offers for site', site, 'deleted');

      return that.processSite(parser, function (err) {
        return that.onSiteProcessed(err, callback);
      });
    }
  }));
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
        'message': 'Error deactivating for site ' + site,
        'error': err.message
      });

      return that.onSiteProcessed(err, callback);
    }
    else {
      LOG.info('Offers for site', site, 'deactivated');

      return that.processSite(parser, function (err) {
        return that.onSiteProcessed(err, callback);
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

    request(    { 
      method: 'GET'
    , uri: url
    , gzip: true,
      headers: {
        'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
        'accept-language': 'en-US,en;q=0.8',
        'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
      },
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }, function (err, response, data) {
      if (err) {
        LOG.error({
          'message': 'Error retrieving index page for ' + site + ' language ' + language + ': ' + url,
          'error': err.message
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

            return that.processPage(pageUrl, parser, language, finishPageProcessing);
          };
        });

        LOG.info('Parsing pages for', site, 'language', language, ':', url);

        async.parallel(functions, function (err) {
          numberOfLanguagesProcessed++;
          return finishLanguageProcessing(err);
        });
      }
      else {
        that.processOffers(parser, language, body, utils.createSingleUseCallback(function (err) {
          if (err) {
            LOG.error({
              'message': 'Error processing offers for ' + site + 'language ' + language + ': ' + url,
              'error': err.message
            });
          }
          else {
            LOG.info('Index page for', site, 'language', language, ':', url, 'parsed successfully');
          }

          numberOfLanguagesProcessed++;
          return finishLanguageProcessing(err);
        }));
      }
    });
  }, function (err) {
    if (err) {
      LOG.error({
        'message': 'Error processing site ' + site,
        'error': err.message
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

Harvester.prototype.processPage = function (url, parser, language, callback) {
  var that = this,
    site = parser.getSite();

  LOG.info('Requesting page for', site, 'language', language, ':', url);

    request.get(url, {
      headers: {
        'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
        'accept-language': 'en-US,en;q=0.8',
        'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
      },
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }, utils.createSingleUseCallback(function (err, response, data) {
    if (err) {
      LOG.error({
        'message': 'Error retrieving page for ' + site + ' language ' + language + ': ' + url,
        'error': err.message
      });

      return callback(err);
    }

    LOG.info('Parsing page to get offers links for ' + site + ' language ' + language + ': ' + url);

    that.processOffers(parser, language, parser.parseResponseBody(data), utils.createSingleUseCallback(function (err) {
      return callback(err);
    }));
  }));
};

Harvester.prototype.processOffers = function (parser, language, body, callback) {
  var that = this,
    site = parser.getSite();

  var links = parser.getOfferLinks(body, language),
    linksNumber = _.size(links);

  LOG.info('Total links found on page', linksNumber);

  var functions = _.map(links, function (url, index) {
    return function (finishOfferProcessing) {
      LOG.debug('Checking offer', index + 1, 'of', linksNumber, url);

      that.db.offers.findOne({
        url: url
      }, function (err, offer) {
        if (err) {
          LOG.error({
            'message': 'Error checking offer by url ' + url,
            'error': err.message
          });

          return finishOfferProcessing(err);
        }

        if (parser.config.reactivate && offer) {
          that.reactivateOffer(offer, finishOfferProcessing);
        }
        else if (offer) {
          LOG.debug('Offer', url, 'has been already parsed. Skipped.');

          return finishOfferProcessing();
        }
        else {
          LOG.debug('Retrieving offer for', site, 'language', language, ':', url);


    request.get(url, {
      headers: {
        'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
        'accept-language': 'en-US,en;q=0.8',
        'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
      },
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }, utils.createSingleUseCallback(function (err, response, data) {
            if (err) {
              LOG.error({
                'message': 'Error retrieving offer for ' + site + ' language ' + language + ': ' + url,
                'error': err.message
              });

              return finishOfferProcessing(err);
            }

            that.parseOffer(url, language, parser.getValidParser(url), data, utils.createSingleUseCallback(function (err) {
              return finishOfferProcessing(err);
            }));
          }));
        }
      });
    };
  });

  async.waterfall(functions, function (err) {
    return callback(err);
  });
};

Harvester.prototype.reactivateOffer = function (offer, callback) {
  var that = this;

  LOG.debug('Offer #Id', offer._id, offer.url, 'has been already parsed. Reactivating.');

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
  }, utils.createSingleUseCallback(function (err, doc, lastErrorObject) {
    if (err) {
      LOG.error({
        'message': 'Error reactivating offer #Id ' + offer._id,
        'error': err.message
      });
    }

    return callback(err);
  }));
};

Harvester.prototype.parseOffer = function (url, language, parser, body, callback) {
  console.time("Harvester.parseOffer");

  var that = this,
    site = parser.getSite(),
    runningTime = new Date(),
    offer = {
      'url': url,
      'site': site,
      'active': true
    };

  LOG.info('Parsing offer for ' + site + ' language ' + language + ': ' + url);

  async.series([
   function (done) {
        parser.parseOffer(body, language, function (err, res) {
          if (err) {
            LOG.error({
              'message': 'Error parsing data for ' + site + ' language ' + language + ': ' + url,
              'error': err.message
            });

            return done(err);
          }

          _.extend(offer, res);

          _.extend(offer, {
            'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
          });

          return done();
        });
   },
   function (done) {
        that.saveOffer(offer, function (err) {
          if (err) {
            LOG.error({
              'message': 'Error saving parsed offer ' + url,
              'error': err.message
            });

            return done(err);
          }

          return done();
        });
    }
   ],
    function (err) {
      if (err) {
        LOG.error({
          'message': 'Error parsing offer ' + url,
          'error': err.message
        });
      }

      console.timeEnd("Harvester.parseOffer");

      callback(err);
    });
};

Harvester.prototype.saveOffer = function (offer, callback) {
  console.time("Harvester.saveOffer");

  var that = this;

  LOG.debug('Saving offer', offer);

  that.db.offers.save(offer, utils.createSingleUseCallback(function (err, saved) {
    if (err || !saved) {
      LOG.error({
        'message': 'Error saving offer ' + offer.url,
        'error': err.message
      });

      return callback(err);
    }

    LOG.info('Offer', offer.url, 'saved with id ' + offer._id);

    offer = null;
    saved = null;

    console.timeEnd("Harvester.saveOffer");

    return callback();
  }));
};

Harvester.prototype.onSiteProcessed = function (err, callback) {
  if (err) {
    LOG.error({
      'message': 'Error processing site',
      'error': err.message
    });
  }
  else {
    LOG.info('Site processed successfully');
  }

  return callback(err);
};

Harvester.prototype.onHarvestingFinished = function (err, callback) {
  if (err) {
    LOG.error({
      'message': 'Harvesting failed',
      'error': err.message
    });
  }
  else {
    LOG.info('Harvesting finished');
  }

  return callback(err, 'OK');
};

    var app = new Harvester();
    app.start(true);

module.exports = Harvester;
