var config = require('./config/env'),
  Agenda = require("agenda"),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  util = require("util"),
  SessionFactory = require("./services/SessionFactory");

var agenda = new Agenda({db: {address: config.db.uri}});

var db = SessionFactory.getDbConnection();
var queue = SessionFactory.getQueueConnection('offers_queue');

agenda.define('execute harvester', function (job, done) {
  LOG.info(util.format('[STATUS] [OK] Parforming harvesting session'));

  db.sites.find({
    'is_active': true
  }, function (err, result) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] Getting active sites failed', err));
      return done(err);
    }

    if (result.length === 0) {
      LOG.info('[STATUS] [Warning] No active sites found');
      return done();
    }

    _.each(result, function (site) {
      var payload = {
        "site": site.url,
        "reactivate": true
      };

      queue.enqueue('harvester_run_event', payload, function (err, job) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] Enqueing harvester\'s job failed', site.url, err));
          return;
        }

        LOG.info(util.format('[STATUS] [OK] [%s] Harvester run job enqueued', site.url));
      });
    });

    done();
  });
});

agenda.define('execute procurer', function (job, done) {
  var options = {};

  queue.enqueue('procurer_run_event', options, function (err, job) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] Error enqueueing procurer run job', err));
      return done(err);
    }

    LOG.info('[STATUS] [OK] Procurer run job enqueued');
    return done(err, options);
  });
});

agenda.on('ready', function() {
  var harvesterJob = agenda.create('execute harvester');
  harvesterJob.repeatEvery(config.harvester.execution.rule).save();

  var procurerJob = agenda.create('execute procurer');
  procurerJob.repeatAt(config.procurer.execution.rule).save();

  agenda.start();
});
