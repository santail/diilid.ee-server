'use strict';

var config = require('./config/environment'),
    activeSites = config.activeSites,
    db = require("mongojs").connect(config.db.url, config.db.collections),
    async = require('async'),
    _ = require('underscore')._,
    cron = require('cron').CronJob;
    
new cron(config.notifier.execution.rule, function() {
    
});