'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    cli = require('nash')(),
    LOG = require("./services/Logger");

require('nodetime').profile({
  accountKey: 'ddd532b852f953c005e71b17c4cfb79b640faa77',
  appName: 'SalesTracker'
});

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


