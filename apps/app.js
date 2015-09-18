'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    nash = require('nash'),
    cli = nash(),
    LOG = require("./services/Logger"),
    utils = require("./services/Utils");

LOG.info('Running SalesTracker.eu-server application');

var forceMode;

cli.flag('-f').handler(utils.createSingleUseCallback(function (value, done) {
    forceMode = true;
    LOG.info('Force mode on');

    done();
}));

cli.command('harvester').handler(utils.createSingleUseCallback(function (data, flags, done) {
    LOG.info('Starting Harvester');

    var app = new harvester();
    app.start(forceMode);

    done();
}));

cli.command('notifier').handler(utils.createSingleUseCallback(function (data, flags, done) {
    LOG.info('Starting Harvester');

    var app = new notifier();
    app.start(forceMode);

    done();
}));

cli.run(process.argv, utils.createSingleUseCallback(function (err) {
  if (err) {
    LOG.info('Error starting', err);
  }

  LOG.info('Running handler');
}));


