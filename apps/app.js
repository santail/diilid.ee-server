'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    cli = require('nash')();

require('nodetime').profile({
  accountKey: 'ddd532b852f953c005e71b17c4cfb79b640faa77',
  appName: 'SalesTracker'
});

var forceMode;

cli.flag('-f').handler(function () {
    forceMode = true;
});

cli.command('harvester').handler(function () {
    var app = new harvester();
    app.start(forceMode);
});

cli.command('notifier').handler(function () {
    var app = new notifier();
    app.start(forceMode);
});

cli.run(process.argv);


