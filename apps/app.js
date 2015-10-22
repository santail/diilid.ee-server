'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    nash = require('nash'),
    cli = nash(),
    LOG = require("./services/Logger");

LOG.info('Running SalesTracker.eu-server application');

var forceMode;

cli.flag('-f').handler(function (value, done) {
    forceMode = true;
    LOG.info('Force mode on');

    done();
});

cli.command('harvester').handler(function (data, flags, done) {
    LOG.info('Starting Harvester');

    var app = new harvester();
    app.start(forceMode);

    done();
});

cli.command('notifier').handler(function (data, flags, done) {
    LOG.info('Starting Harvester');

    var app = new notifier();
    app.start(forceMode);

    done();
});

cli.run(process.argv, function (err) {
  if (err) {
    LOG.info('Error starting', err);
  }

  LOG.info('Running handler');
});


