'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    cli = require('nash')(),
    LOG = require("./services/Logger");

LOG.info('Running SalesTracker.eu-server application');

var forceMode;

cli.flag('-f').handler(function () {
    forceMode = true;
    LOG.info('Force mode on');
});

cli.command('harvester').handler(function () {
    LOG.info('Starting Harvester');

    var app = new harvester();
    app.start(forceMode);
});

cli.command('notifier').handler(function () {
    LOG.info('Starting Harvester');

    var app = new notifier();
    app.start(forceMode);
});

cli.run(process.argv);


