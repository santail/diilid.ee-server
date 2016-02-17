var config = require('./config/env'),
  mongojs = require('mongojs'),
  monq = require('monq'),
  async = require('async'),
  _ = require('underscore')._,
  Agenda = require("agenda"),
  LOG = require("./services/Logger"),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
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

var pmx = require('pmx').init({
  http          : true, // HTTP routes logging (default: true)
  ignore_routes : [/socket\.io/, /notFound/], // Ignore http routes with this pattern (Default: [])
  errors        : true, // Exceptions loggin (default: true)
  custom_probes : true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
  network       : true, // Network monitoring at the application level
  ports         : true  // Shows which ports your app is listening on (default: false)
});

var Harvester = function () {
  LOG.debug('Connecting to database', config.db.uri);

  this.db = mongojs(config.db.uri, config.db.collections);

  var client = monq(config.db.uri, { safe: true });
  this.queue = client.queue('offers_queue');
};

Harvester.prototype.start = function () {
  var that = this;

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
};

Harvester.prototype.run = function () {
  var that = this;

  async.series([
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
    });
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

  LOG.info('[STATUS] [OK] [', site, '] Harvesting started');

  var parser = parserFactory.getParser(site);

  async.waterfall([
      function stepCleanup(done) {
        if (parser.config.cleanup) {
          LOG.info('[STATUS] [OK] [', site, '] Cleanup started');

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

            LOG.info('[STATUS] [OK] [', site, '] Cleanup finished');

            return done(null);
          });
        }
        else {
          done(null);
        }
      },
      function stepDeactivate(done) {
        LOG.profile("Harvester.deactivate");

        if (parser.config.reactivate) {
          LOG.info('[STATUS] [OK] [', site, '] Deactivation started');

          that.db.offers.update({
            'site': site
          }, {
            $set: {
              active: false,
              modified: new Date()
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

            LOG.info('[STATUS] [OK] [', site, '] Deactivation finished');

            return done(null);
          });
        }
        else {
          return done(null);
        }
      },
      function stepProcessSite(done) {
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

      LOG.info('[STATUS] [OK] [', site, '] Harvesting finished');

      return callback(err);
    });
};

Harvester.prototype.processSite = function (site, callback) {
  var that = this,
    parser = parserFactory.getParser(site),
    languages = _.keys(parser.config.index);

  LOG.info('[STATUS] [OK] [', site, '] Processing started.', 'Languages', languages);

  var functions = _.map(languages, function (language) {
    return function (done) {
      parser.gatherOffers(language, that.processOffer.bind(that), done);
    };
  });

  async.waterfall(functions, function (err, results) {
    parser = null;

    if (err) {
      LOG.error({
        'message': 'Error processing site ' + site,
        'error': err.message
      });

      pmx.notify({
        success : false,
        'message': 'Error processing site ' + site,
        'error': err.message
      });

      return callback(err);
    }

    LOG.info('[STATUS] [OK] [', site, '] Processing finished.');

    return callback();
  });
};


Harvester.prototype.processOffer = function (offer, callback) {
  var that = this;

  that.queue.enqueue('offer_update_event', offer, function (err, job) {
    if (err) {
      LOG.error({
        'message': 'Error enqueueing offer ' + (offer.id ? offer.id : '') + ' for site ' + (offer.site ? offer.site : ''),
        'error': err.message
      });

      return callback(err);
    }

     LOG.info('[STATUS] [OK] [', offer.site, '] [', offer.language, '] [', offer.id , '] Offer enqueued for processing');

    return callback(err, offer);
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


var harvester = new Harvester();
harvester.start();
