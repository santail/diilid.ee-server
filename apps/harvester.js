var config = require('./config/environment'),
  mongojs = require('mongojs'),
  async = require('async'),
  _ = require('underscore')._,
  Agenda = require("agenda"),
  LOG = require("./services/Logger"),
  request = require('request'),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
  utils = require("./services/Utils"),
  ParserFactory = require("./services/ParserFactory"),
  parserFactory = new ParserFactory();

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

Harvester.prototype.run = function () {
  var that = this;

  LOG.debug('Connecting to database', config.db.uri);

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

      LOG.info('Run finished with result', result);

      that.db.close();
    });
};

Harvester.prototype.runPakkumisedHarvesting = function (callback) {
  var that = this;

  LOG.info('Harvesting Pakkumised.ee');

  if (!config.pakkumised) {
    LOG.info('Pakkumised.ee is switched off');
    return callback(null);
  }

  var pageNumber = 0,
    pageRepeats = false,
    lastId = null;

  async.whilst(
    function () {
      return !pageRepeats;
    },
    function (finishPageProcessing) {
      pageNumber++;

      var pageUrl = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';

      that.processPage(pageUrl, 'pakkumised.ee', 'est', utils.createSingleUseCallback(function (err, deals) {
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
};

Harvester.prototype.runHarvesting = function (callback) {
  var that = this;

  LOG.debug('Harvesting preconfigured sources');

  var numberOfSites = _.size(config.activeSites);

  LOG.debug('Total sites available', numberOfSites, config.activeSites);
  LOG.debug('Processing sites');

  var activeSites = _.filter(_.keys(config.activeSites), function (site) {
    return config.activeSites[site];
  });

  var functions = _.map(activeSites, function (site, index) {
    return function (done) {
      that.harvestSite(site, done);
    };
  });

  async.waterfall(functions, function (err, results) {
    if (err) {
      LOG.error({
        'message': '[STATUS] [Failed] Error processing sites',
        'error': err.message
      });
    }

    return that.onHarvestingFinished(err, callback);
  });
};

Harvester.prototype.harvestSite = function (site, callback) {
  var that = this;

  LOG.info('[STATUS] [OK] Processing site', site);

  var parser = parserFactory.getParser(site);

  async.waterfall([
      function (done) {
        if (parser.config.cleanup) {
          LOG.debug('Remove excisting offers for site', site, 'and read fresh data');

          that.db.offers.remove({
            'site': site
          }, function (err) {
            if (err) {
              LOG.error({
                'message': 'Error deleting offers for site ' + site,
                'error': err.message
              });

              return done(err);
            }

            LOG.info('[STATUS] [OK] [', site, '] Offers deleted');
            return done(null);
          });
        }
        else {
          done(null);
        }
      },
      function (done) {
        LOG.profile("Harvester.deactivate");

        if (parser.config.reactivate) {
          LOG.debug('Deactivating excisting offers for site', site, 'and read fresh data');

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

              return done(err);
            }

            LOG.info('[STATUS] [OK] [', site, '] Offers deactivated');
            return done(null);
          });
        }
        else {
          return done(null);
        }
      },
      function (done) {
        LOG.profile("Harvester.deactivate");

        LOG.profile("Harvester.processSite");

        that.processSite(site, function (err) {
          if (err) {
            LOG.error({
              'message': 'Error processing site ' + site,
              'error': err.message
            });
          }

          LOG.profile("Harvester.processSite");

          return done(err);
        });
      }
    ],
    function (err, result) {
      if (err) {
        LOG.error({
          'message': 'Error processing site',
          'error': err.message
        });
      }

      LOG.info('[STATUS] [OK] [', site, '] Site processing finished');
      return callback(err);
    });
};

Harvester.prototype.processSite = function (site, callback) {
  var that = this,
    parser = parserFactory.getParser(site),
    languages = _.keys(parser.config.index);

  LOG.debug('Site', site, 'has', _.size(languages), 'languages', languages);

  var functions = _.map(languages, function (language) {
    return function (done) {
      that.processIndexPage(site, language, done);
    };
  });

  async.waterfall(functions, function (err, results) {
    if (err) {
      LOG.error({
        'message': 'Error processing site ' + site,
        'error': err.message
      });
    }

    LOG.info('[STATUS] [OK] [', site, '] Site processed');
    return callback(err);
  });
};

Harvester.prototype.processIndexPage = function (site, language, callback) {
  LOG.profile('Harvester.processIndexPage');

  var that = this,
    parser = parserFactory.getParser(site),
    url = parser.config.index[language];

  LOG.debug("Retrieving index page:", url);

  async.waterfall([
    function (done) {
      LOG.profile('IndexRequest');

      request({
        method: 'GET',
        uri: url,
        gzip: true,
        headers: {
          'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
          'accept-language': 'en-US,en;q=0.8',
          'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
        },
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      }, function (err, response, data) {
        if (err) {
          LOG.error({
            'message': 'Error retrieving index page: ' + url,
            'error': err.message
          });
        }

        LOG.profile('IndexRequest');

        return done(err, utils.unleakString(data));
      });
    },
    function (data, done) {
      parser.parseResponseBody(data, function (err, dom) {
        if (err) {
          LOG.error({
            'message': 'Error parsing response body to DOM',
            'error': err.message
          });
        }

        done(err, dom);
      });
    },
    function (dom, done) {
      var paging = parser.getPagingParameters(language, dom);

      if (paging) {
        var pages = paging.pages,
          pagesNumber = _.size(pages);

        var functions = _.map(pages, function (pageUrl, index) {
          return function (finishPageProcessing) {
            LOG.info('Processing page', index + 1, 'from', pagesNumber);

            dom = null;

            return that.processPage(pageUrl, site, language, finishPageProcessing);
          };
        });

        LOG.debug('Parsing pages for', site, 'language', language, ':', url);

        async.series(functions, done);
      }
      else {
        var links = parser.getOfferLinks(dom, language),
          linksNumber = _.size(links);

        dom = null;

        LOG.debug('Total links found on page', linksNumber);

        that.processOffers(site, language, links, done);
      }
    }
  ], function (err, result) {
    if (err) {
      LOG.error({
        'message': 'Error processing index page for ' + site + 'language ' + language + ': ' + url,
        'error': err.message
      });
    }

    LOG.profile('Harvester.processIndexPage');

    callback(err);
  });
};

Harvester.prototype.processPage = function (url, site, language, callback) {
  LOG.profile('Harvester.processPage');

  var that = this,
    parser = parserFactory.getParser(site);

  LOG.info('Requesting page for', site, 'language', language, ':', url);

  async.waterfall([
    function (done) {
        request.get(url, {
            headers: {
              'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
              'accept-language': 'en-US,en;q=0.8',
              'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
            },
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
          },
          function (err, response, data) {
            if (err) {
              LOG.error({
                'message': 'Error retrieving page for ' + site + ' language ' + language + ': ' + url,
                'error': err.message
              });
            }

            return done(err, data);
          });
    },
    function (data, done) {
        parser.parseResponseBody(data, function (err, dom) {
          if (err) {
            LOG.error({
              'message': 'Error parsing response body to DOM',
              'error': err.message
            });
          }

          data = null;

          done(err, dom);
        });
    },
    function (dom, done) {
        var links = parser.getOfferLinks(dom, language),
          linksNumber = _.size(links);

        LOG.debug('Total links found on page', linksNumber);

        dom = null;

        done(null, links);
    },
    function (links, done) {
        that.processOffers(site, language, links, done);
    }],
    function (err, result) {
      LOG.profile('Harvester.processPage');

      callback(err, result);
    });
};

Harvester.prototype.processOffers = function (site, language, links, callback) {
  LOG.profile('Harvester.processOffers');

  var that = this;

  var functions = _.map(links, function (url, index) {
    return function (finishOfferProcessing) {
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

        var parser = parserFactory.getParser(site);

        if (parser.config.reactivate && offer) {
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
          }, function (err, doc, lastErrorObject) {
            if (err) {
              LOG.error({
                'message': 'Error reactivating offer #Id ' + offer._id,
                'error': err.message
              });
            }

            LOG.info('[STATUS] [OK] [', site, '] [', url , '] Offer reactivated');

            return finishOfferProcessing(err);
          });
        }
        else if (offer) {
          LOG.info('[STATUS] [OK] [', site, '] [', url , '] Offer exists. Skipped.');

          return finishOfferProcessing();
        }
        else {
          LOG.profile('Harvester.processOffer');

          LOG.debug('Retrieving offer for', site, 'language', language, ':', url);

          async.waterfall([
            function (done) {
              LOG.profile('Retrieve offer');
                request.get(url, {
                  headers: {
                    'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
                    'accept-language': 'en-US,en;q=0.8',
                    'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
                  },
                  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
                }, function (err, response, data) {
                  if (err) {
                    LOG.error({
                      'message': 'Error retrieving offer for ' + site + ' language ' + language + ': ' + url,
                      'error': err.message
                    });
                  }

                  LOG.profile('Retrieve offer');

                  done(err, data);
                });
            },
            function (data, done) {
              LOG.profile('Parse offer DOM');

                var parser = parserFactory.getParser(site);

                parser.parseResponseBody(data, function (err, dom) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing response body to DOM',
                      'error': err.message
                    });
                  }

                  LOG.profile('Parse offer DOM');

                  data = null;

                  done(err, dom);
                });
            },
            function (dom, done) {
                LOG.profile("parser.ParseOffer");

                var parser = parserFactory.getParser(site);

                parser.parse(dom, language, function (err, offer) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing data for ' + site + ' language ' + language + ': ' + url,
                      'error': err.message
                    });
                  }

                  LOG.profile("parser.ParseOffer");

                  dom = null;

                  return done(err, offer);
                });
            },
            function (offer, done) {
                var runningTime = new Date(),
                  _offer = {
                    'url': url,
                    'site': site,
                    'active': true
                  };

                _.extend(_offer, offer);

                _.extend(_offer, {
                  'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
                });

                offer = null;

                done(null, _offer);
            },
            function (offer, done) {
              LOG.profile("Harvester.saveOffer");

              LOG.debug('Saving offer', offer);

              that.db.offers.save(offer, function (err, saved) {
                offer = null;

                if (err || !saved) {
                  LOG.error({
                    'message': 'Error saving offer',
                    'error': err.message
                  });

                  return done(err);
                }

                LOG.info('[STATUS] [OK] [', site, '] [', saved.url , '] Offer saved with id ' + saved._id);

                LOG.profile("Harvester.saveOffer");

                return done(null, saved);
              });
            }
           ],
            function (err, saved) {
              LOG.profile('Harvester.processOffer');

              saved = null;

              return finishOfferProcessing(err);
            });
        }
      });
    };
  });

  async.parallelLimit(functions, 5, function (err, results) {
    if (err) {
      LOG.error({
        'message': 'Error processing offers for ' + site + ' language ' + language,
        'error': err.message
      });
    }

    LOG.profile('Harvester.processOffers');

    return callback(err, results);
  });
};

Harvester.prototype.onHarvestingFinished = function (err, callback) {
  if (err) {
    LOG.error({
      'message': 'Harvesting failed',
      'error': err.message
    });

    return callback(err, 'NOK');
  }

  LOG.info('[STATUS] [OK] Harvesting finished');
  return callback(err, 'OK');
};

var app = new Harvester();
app.run();

module.exports = Harvester;
