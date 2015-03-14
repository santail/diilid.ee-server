'use strict';

var config = require('./config/environment'),
    activeSites = config.activeSites,
    mongojs = require("mongojs"),
    async = require('async'),
    _ = require('underscore')._,
    cron = require('cron').CronJob;

var Notifier = function () {};

Notifier.prototype.run = function () {
    var runningTime = new Date(),
        db = mongojs.connect(config.db.url).collection('notification');

    db.notification.insert();

    console.log('notifier started ...', runningTime);
};

Notifier.prototype.start = function (forceMode) {
    if (forceMode) {
        this.run();
    }
    else {
        new cron(config.notifier.execution.rule, this.run, null, true, "Europe/Tallinn");
    }
};

module.exports = Notifier;
