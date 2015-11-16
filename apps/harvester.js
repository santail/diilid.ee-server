var config = require('./config/environment'),
  mongojs = require('mongojs'),
  monq = require('monq'),
  async = require('async'),
  _ = require('underscore')._,
  Agenda = require("agenda"),
  LOG = require("./services/Logger"),
  request = require('request'),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
  utils = require("./services/Utils"),
  parserFactory = require("./services/ParserFactory");

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

var Harvester = function Harvester() {
  LOG.debug('Connecting to database', config.db.uri);

  this.db = mongojs(config.db.uri, config.db.collections);
  this.db.collection('offers');

  var client = monq(config.db.uri, { safe: true });
  this.queue = client.queue('offers_queue');
};

Harvester.prototype.start = function start(forceMode) {
  var that = this;

  if (forceMode) {
    LOG.info('Running in force mode. No recurring.');
    return that.run(function onRunFinished() {});
  }
  else {
    LOG.info('Running in reccuring mode.', config.harvester.execution.rule);

    var agenda = new Agenda({
      db: {
        address: config.db.uri
      },
      defaultLockLifetime: 10000
    });

    agenda.define('execute harvester', function executeHarvesterJob(job, done) {
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

Harvester.prototype.run = function run() {
  var that = this;

  async.series([
      function runPakkumisedHarvestingStep(done) {
        that.runPakkumisedHarvesting(done);
      },
      function runHarvestingStep(done) {
        that.runHarvesting(done);
      }
    ],
    function handleRunErrors(err, result) {
      if (err) {
        LOG.error({
          'message': 'Error completing run',
          'err': err.message
        });
      }

      LOG.info('Run finished with result', result);
    });
};

Harvester.prototype.runPakkumisedHarvesting = function runPakkumisedHarvesting(callback) {
  var that = this;

  LOG.info('Harvesting Pakkumised.ee');

  if (!config.pakkumised) {
    LOG.info('Pakkumised.ee is switched off');
    return callback(null);
  }

  var pageNumber = 0,
    pageRepeats = false,
    lastUrl = null;

  async.whilst(
    function checkPagesLooping() {
      return !pageRepeats;
    },
    function processPakkumised(finishPageProcessing) {
      pageNumber++;

      var pageUrl = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';

      that.processPage(pageUrl, 'pakkumised.ee', 'est', function processPage(err, links) {
        if (err) {
          LOG.error({
            'message': 'Error processing page from pakkumised.ee ' + pageUrl,
            'error': err.message
          });
        }

        if (!_.isEmpty(links) && lastUrl !== _.last(links)) {
          lastUrl = _.last(links);
        }
        else {
          pageRepeats = true;
        }

        return finishPageProcessing(err);
      });
    },
    function handlePakkumisedErrors(err) {
      return that.onHarvestingFinished(err, callback);
    }
  );
};

Harvester.prototype.runHarvesting = function runHarvesting(callback) {
  var that = this;

  LOG.debug('Harvesting preconfigured sources');

  var numberOfSites = _.size(config.activeSites);

  LOG.debug('Total sites available', numberOfSites, config.activeSites);
  LOG.debug('Processing sites');

  var activeSites = _.filter(_.keys(config.activeSites), function isSiteActive(site) {
    return config.activeSites[site];
  });

  var functions = _.map(activeSites, function processSite(site, index) {
    return function harvestSite(done) {
      that.harvestSite(site, done);
    };
  });

  async.waterfall(functions, 
    function handleProcessingSitesError(err, results) {
      if (err) {
        LOG.error({
          'message': '[STATUS] [Failed] Error processing sites',
          'error': err.message
        });
      }
  
      return that.onHarvestingFinished(err, callback);
    });
};

Harvester.prototype.harvestSite = function harvestSite(site, callback) {
  var that = this;

  LOG.info('[STATUS] [OK] Processing site', site);

  var parser = parserFactory.getParser(site);

  async.waterfall([
      function cleanupOffers(done) {
        if (parser.config.cleanup) {
          LOG.debug('Remove excisting offers for site', site, 'and read fresh data');

          that.db.offers.remove({
            'site': site
          }, function cleanupOffersResult(err) {
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
      function deactivateOffers(done) {
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
          }, function deactivateOffersResult(err) {
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
      function processSite(done) {
        LOG.profile("Harvester.deactivate");

        LOG.profile("Harvester.processSite");

        that.processSite(site, function processSiteResult(err) {
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
    function handleHarvestSiteError(err, result) {
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

Harvester.prototype.processSite = function processSite(site, callback) {
  var that = this,
    parser = parserFactory.getParser(site),
    languages = _.keys(parser.config.index);

  LOG.debug('Site', site, 'has', _.size(languages), 'languages', languages);

  var functions = _.map(languages, function processEachLanguage(language) {
    return function processIndexPageHandler(done) {
      that.processIndexPage(site, language, done);
    };
  });

  async.waterfall(functions, 
    function handlerProcessSiteError(err, results) {
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

Harvester.prototype.processIndexPage = function processIndexPage(site, language, callback) {
  LOG.profile('Harvester.processIndexPage');

  var that = this,
    parser = parserFactory.getParser(site),
    url = parser.config.index[language];

  LOG.debug("Retrieving index page:", url);

  async.waterfall([
    function requestIndexPage(done) {
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
      }, function requestIndexPageResult(err, response, data) {
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
    function parseResponseBody(data, done) {
      parser.parseResponseBody(data, function parseResponseBodyResult(err, dom) {
        if (err) {
          LOG.error({
            'message': 'Error parsing response body to DOM',
            'error': err.message
          });
        }

        done(err, dom);
      });
    },
    function parseDOM(dom, done) {
      var paging = parser.getPagingParameters(language, dom);

      if (paging) {
        var pages = paging.pages,
          pagesNumber = _.size(pages);

        var functions = _.map(pages, function processPages(pageUrl, index) {
          return function processPageStep(finishPageProcessing) {
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
  ], 
  function handleProcessIndexPageError(err, result) {
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

  LOG.info('Processing page for', site, 'language', language, ':', url);

  async.waterfall([
    function requestPage(done) {
        request.get(url, {
            headers: {
              'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
              'accept-language': 'en-US,en;q=0.8',
              'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
            },
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
          },
          function requestPageResult(err, response, data) {
            if (err) {
              LOG.error({
                'message': 'Error retrieving page for ' + site + ' language ' + language + ': ' + url,
                'error': err.message
              });
            }

            return done(err, data);
          });
    },
    function parseResponseBody(data, done) {
        parser.parseResponseBody(data, function parseResponseBodyResult(err, body) {
          if (err) {
            LOG.error({
              'message': 'Error parsing response body to DOM',
              'error': err.message
            });
          }

          data = null;

          done(err, body);
        });
    },
    function parseLinks(body, done) {
        var links = parser.getOfferLinks(body, language),
          linksNumber = _.size(links);

        LOG.debug('Total links found on page', linksNumber);

        body = null;

        done(null, links);
    },
    function (links, done) {
      (function (that, site, language, links, callback) {
        var functions = _.map(links, function processLinks(link) {
          return function processLink(done) {
            that.queue.enqueue('offer_update_event', { 'site': site, 'language': language, 'link': link }, function linksEnqueued(err, job) {
              if (err) {
    
              }
    
               LOG.info('[STATUS] [OK] [', site, '] [', link , '] Offer enqueued for processing');
    
              done(err, link);
            });
          };
        });
    
        async.series(functions, 
          function handleProcessLinksError(err, links) {
            if (err) {
      
            }
      
            callback(err, links);
          });
    
      }) (that, site, language, links, done);
    }],
    function (err, result) {
      LOG.profile('Harvester.processPage');

      callback(err, result);
    });
};

Harvester.prototype.onHarvestingFinished = function onHarvestingFinished(err, callback) {
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

module.exports = Harvester;
