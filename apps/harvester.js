var async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  memwatch = require('memwatch-next'),
  heapdump = require('heapdump'),
  util = require("util"),
  parserFactory = require("./services/ParserFactory"),
  SessionFactory = require("./services/SessionFactory");

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

var worker = SessionFactory.getWorkerConnection(['offers_queue']);

worker.register({
  'harvester_run_event': function harvesterRunEventHandler(event, done) {
    var harvester = new Harvester();

    LOG.info(util.format('[STATUS] [OK] [%s] Harvesting event received %r', event.site, event));

    var options = _.extend(event, {});
    var site = options.site;
  
    SessionFactory.getDbConnection().offers.remove({
      'site': site,
      'active': false
    }, function (err) {
      LOG.profile("Harvester.cleanup");

      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] Cleanup failed', site, err));
        return;
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Cleanup finished', site));
      return;
    });

    harvester.run(options, done);
  }
});

worker.on('complete', function (data) {
  var site = data.params.site;

  var db = SessionFactory.getDbConnection();

  db.jobs.remove({_id: data._id}, function (err, lastErrorObject) {
    if (err) {
      LOG.debug(util.format('[STATUS] [Failure] Removing event failed', err));
      return;
    }
  });

  db.sites.update({
    'url': site
  }, {
    $set: {
      last_run: new Date()
    }
  }, {
    'multi': false,
    'new': false
  }, function (err) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] Setting last run timestamp failed', site, err));
      return;
    }

    LOG.info(util.format('[STATUS] [OK] [%s] Setting last run timestamp finished', site));
    return;
  });
});

worker.start();

var Harvester = function () {
  this.db = SessionFactory.getDbConnection();
  this.queue = SessionFactory.getQueueConnection('offers_queue');
};

Harvester.prototype.run = function (options, callback) {
  var that = this,
    site = options.site;

  LOG.info(util.format('[STATUS] [OK] [%s] Harvesting started', site));

  async.waterfall([
      function stepCleanup(done) {
        if (!options.cleanup) {
          return done();
        }

        LOG.profile("Harvester.cleanup");

        LOG.info(util.format('[STATUS] [OK] [%s] Cleanup started', site));

        that.db.offers.remove({
          'site': site
        }, function (err) {
          LOG.profile("Harvester.cleanup");

          if (err) {
            LOG.error(util.format('[STATUS] [Failure] [%s] Cleanup failed', site, err));
            return done(err);
          }

          LOG.info(util.format('[STATUS] [OK] [%s] Cleanup finished', site));
          return done();
        });

      },
      function stepDeactivate(done) {
        if (!options.reactivate) {
          return done();
        }

        LOG.profile("Harvester.deactivate");

        LOG.info(util.format('[STATUS] [OK] [%s] Deactivation started', site));

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
          LOG.profile("Harvester.deactivate");

          if (err) {
            LOG.error(util.format('[STATUS] [Failure] [%s] Deactivation failed', site, err));
            return done(err);
          }

          LOG.info(util.format('[STATUS] [OK] [%s] Deactivation finished', site));
          return done();
        });
      },
      function stepProcessSite(done) {
        that.processSite(site, done);
      }
    ],
    function (err, result) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] Harvesting failed', site, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Harvesting finished', site));
      return callback();
    });
};

Harvester.prototype.processSite = function (site, callback) {
  LOG.profile("Harvester.processSite");

  LOG.info(util.format('[STATUS] [OK] [%s] Processing started', site));

  var that = this,
    parser = parserFactory.getParser(site),
    languages = _.keys(parser.config.index);

  var functions = _.map(languages, function (language) {
    return function (done) {
      parser.gatherOffers(language, that.processOffer.bind(that), done);
    };
  });

  async.waterfall(
    functions,
    function (err, results) {
      parser = null;

      LOG.profile("Harvester.processSite");

      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] Processing failed', site, err));
        pmx.notify({
          success: false,
          'message': util.format('[STATUS] [Failure] [%s] Processing failed', site, err),
          'error': err
        });

        return callback(null);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Processing finished', site));
      return callback(null);
    }
  );
};

Harvester.prototype.processOffer = function (offer, callback) {
  this.queue.enqueue('offer_fetch_event', offer, function (err, job) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] [%s] Enqueueing offer for processing failed', offer.site, offer.language, offer.id, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] [%s] Enqueueing offer for processing finished', offer.site, offer.language, offer.id));
    return callback(null, offer);
  });
};

module.exports = Harvester;
