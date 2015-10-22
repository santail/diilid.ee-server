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

  LOG.info('Harvesting preconfigured sources');

  var numberOfSites = _.size(config.activeSites);

  LOG.info('Total sites available', numberOfSites, config.activeSites);
  LOG.info('Processing sites');

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
        'message': 'Error processing active sites',
        'error': err.message
      });
    }

    return that.onHarvestingFinished(err, callback);
  });
};

Harvester.prototype.harvestSite = function (site, callback) {
  var that = this;

  LOG.info('Processing site', site);

  var parser = parserFactory.getParser(site);

  async.waterfall([
      function (done) {
        if (parser.config.cleanup) {
          LOG.info('Remove excisting offers for site', site, 'and read fresh data');

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

            LOG.info('Offers for site', site, 'deleted');
            return done(null);
          });
        }
        else {
          done(null);
        }
      },
      function (done) {
        console.time("Harvester.deactivate");

        if (parser.config.reactivate) {
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

              return done(err);
            }
            else {
              LOG.info('Offers for site', site, 'deactivated');
              return done(null);
            }
          });
        }
        else {
          return done(null);
        }
      },
      function (done) {
        console.timeEnd("Harvester.deactivate");

        console.time("Harvester.processSite");

        that.processSite(site, function (err) {
          if (err) {
            LOG.error({
              'message': 'Error processing site ' + site,
              'error': err.message
            });
          }

          console.timeEnd("Harvester.processSite");

          return done(err);
        });
      }
    ],
    function (err, result) {
      if (err) {
        LOG.error({
          'message': 'Error cleanup offers before processing site ' + site,
          'error': err.message
        });
      }

      return that.onSiteProcessed(err, callback);
    });
};

Harvester.prototype.processSite = function (site, callback) {
  var that = this,
    parser = parserFactory.getParser(site),
    languages = _.keys(parser.config.index);

  LOG.info('Site', site, 'has', _.size(languages), 'languages', languages);

  var functions = _.map(languages, function (language, index) {
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

    return callback(err);
  });
};

Harvester.prototype.processIndexPage = function (site, language, callback) {
  console.time('Harvester.processIndexPage');

  var that = this,
    parser = parserFactory.getParser(site),
    url = parser.config.index[language];

  LOG.info("Retrieving index page:", url);

  async.waterfall([
    function (done) {
      console.time('IndexRequest');
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

        console.timeEnd('IndexRequest');

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

            return that.processPage(pageUrl, site, language, finishPageProcessing);
          };
        });

        LOG.info('Parsing pages for', site, 'language', language, ':', url);

        async.series(functions, function (err, results) {
          return done(err, results);
        });
      }
      else {
        var links = parser.getOfferLinks(dom, language),
          linksNumber = _.size(links);

        dom = null;

        LOG.info('Total links found on page', linksNumber);

        that.processOffers(site, language, links, function (err) {
          if (err) {
            LOG.error({
              'message': 'Error processing offers for ' + site + 'language ' + language + ': ' + url,
              'error': err.message
            });
          }

          return done(err);
        });
      }
    }
  ], function (err, result) {
    if (err) {
      LOG.error({
        'message': 'Error processing index page for ' + site + 'language ' + language + ': ' + url,
        'error': err.message
      });
    }

    console.timeEnd('Harvester.processIndexPage');

    callback(err);
  });
};

Harvester.prototype.processPage = function (url, site, language, callback) {
  console.time('Harvester.processPage');

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

          done(err, dom);
        });
    },
    function (dom, done) {
        var links = parser.getOfferLinks(dom, language),
          linksNumber = _.size(links);

        LOG.info('Total links found on page', linksNumber);

        done(null, links);
    },
    function (links, done) {
        that.processOffers(site, language, links, done);
    }],
    function (err, result) {
      console.timeEnd('Harvester.processPage');

      callback(err, result);
    });
};

Harvester.prototype.processOffers = function (site, language, links, callback) {
  console.time('Harvester.processOffers');

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
                'error': err.message
              });
            }

            return finishOfferProcessing(err);
          });
        }
        else if (offer) {
          LOG.debug('Offer', url, 'has been already parsed. Skipped.');

          return finishOfferProcessing();
        }
        else {
          console.time('Harvester.processOffer');

          LOG.debug('Retrieving offer for', site, 'language', language, ':', url);

          async.waterfall([
            function (done) {
              console.time('Retrieve offer');
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

                  console.timeEnd('Retrieve offer');

                  done(err, data);
                });
            },
            function (data, done) {
              console.time('Parse offer DOM');

                var parser = parserFactory.getParser(site);

                parser.parseResponseBody(data, function (err, dom) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing response body to DOM',
                      'error': err.message
                    });
                  }

                  console.timeEnd('Parse offer DOM');

                  done(err, dom);
                });
            },
            function (dom, done) {
                console.time("parser.ParseOffer");

                var parser = parserFactory.getParser(site);

                parser.parse(dom, language, function (err, offer) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing data for ' + site + ' language ' + language + ': ' + url,
                      'error': err.message
                    });
                  }

                  console.timeEnd("parser.ParseOffer");

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

                done(null, _offer);
            },
            function (offer, done) {
              console.time("Harvester.saveOffer");

              LOG.debug('Saving offer', offer);

              that.db.offers.save(offer, function (err, saved) {
                if (err || !saved) {
                  LOG.error({
                    'message': 'Error saving offer',
                    'error': err.message
                  });

                  return done(err);
                }

                LOG.info('Offer', saved.url, 'saved with id ' + saved._id);

                console.timeEnd("Harvester.saveOffer");

                return done(null, saved);
              });
            }
           ],
            function (err, offer) {
              console.timeEnd('Harvester.processOffer');

              return finishOfferProcessing(err);
            });
        }
      });
    };
  });

  async.waterfall(functions, function (err, results) {
    if (err) {
      LOG.error({
        'message': 'Error processing offers for ' + site + ' language ' + language,
        'error': err.message
      });
    }

    console.time('Harvester.processOffers');

    return callback(err, results);
  });
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
app.run();

module.exports = Harvester;
