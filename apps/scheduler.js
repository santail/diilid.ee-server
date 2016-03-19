var config = require('./config/env'),
  Agenda = require("agenda"),
  async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  util = require("util"),
  Sessionfactory = require("./services/SessionFactory");

var queue = Sessionfactory.getQueueConnection('offers_queue');

var agenda = new Agenda({db: {address: config.db.uri}});

agenda.define('execute harvester', function (job, done) {
    LOG.debug('Harvesting preconfigured sources');

    var numberOfSites = _.size(config.activeSites);

    LOG.debug('Total sites available', numberOfSites, config.activeSites);
    LOG.debug('Processing sites');

    var activeSites = _.filter(_.keys(config.activeSites), function (site) {
      return config.activeSites[site];
    });

    var functions = _.map(activeSites, function (site, index) {
      return function (siteHarvestFinish) {
        var options = {
          "site": site
        };

        queue.enqueue('harvester_run_event', options, function (err, job) {
          if (err) {
            LOG.error({
              'message': 'Error enqueueing harvester run job',
              'error': err.message
            });

            return siteHarvestFinish();
          }

          LOG.info(util.format('[STATUS] [OK] [%s] Harvester run job enqueued', site));
          siteHarvestFinish();
        });
      };
    });

    async.parallel(functions, function (err, results) {
      if (err) {
        LOG.error({
          'message': '[STATUS] [Failed] Error processing sites',
          'error': err.message
        });

        return done(err);
      }

      LOG.info('[STATUS] [OK] Harvester run job enqueued');

      return done();
    });

});

agenda.define('execute procurer', function (job, done) {
  var options = {};

  queue.enqueue('procurer_run_event', options, function (err, job) {
    if (err) {
      LOG.error({
        'message': 'Error enqueueing procurer run job',
        'error': err.message
      });

      return done(err);
    }

    LOG.info('[STATUS] [OK] Procurer run job enqueued');

    return done(err, options);
  });
});

agenda.on('ready', function() {
  agenda.every(config.harvester.execution.rule, 'execute harvester');

  var procurerJob = agenda.create('execute procurer');
  procurerJob.repeatAt(config.procurer.execution.rule).save();

  agenda.start();
});
