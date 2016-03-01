var async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
  parserFactory = require("./services/ParserFactory"),
  Sessionfactory = require("./services/SessionFactory");

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

var worker = Sessionfactory.getWorkerConnection(['offers_queue']);

worker.register({
  'harvester_run_event': function harvesterRunEventHandler(event, done) {
    var harvester = new Harvester();

    var options = _.extend(event, {});

    harvester.run(options, done);
  }
});

worker.start();

var Harvester = function () {
  this.db = Sessionfactory.getDbConnection('');
  this.queue = Sessionfactory.getQueueConnection('offers_queue');
};

Harvester.prototype.run = function (options, callback) {
  var that = this,
    site = options.site;

  LOG.info('[STATUS] [OK] [', site, '] Harvesting started');

  async.waterfall([
      function stepCleanup(done) {
        if (options.cleanup) {
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

        if (options.reactivate) {
          LOG.info('[STATUS] [OK] [', site, '] Deactivation started');

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

      return that.onHarvestingFinished(err, callback);
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

  that.queue.enqueue('offer_fetch_event', offer, function (err, job) {
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

module.exports = Harvester;
