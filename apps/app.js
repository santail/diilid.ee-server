'use strict';

var harvester = require("./harvester"),
    notifier = require("./notifier"),
    cli = require('nash')();

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


