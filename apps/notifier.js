'use strict';

var config = require('./config/env'),
  _ = require('underscore')._,
  mongojs = require('mongojs'),
  monq = require('monq'),
  Agenda = require("agenda"),
  Messenger = require("./services/Messenger"),
  LOG = require("./services/Logger");

var Notifier = function () {
  this.db = mongojs(config.db.uri, config.db.collections);
};

Notifier.prototype.run = function () {
  var that = this,
    messenger = new Messenger();

  that.db.wishes.find({}, function (err, wishes) {
    if (err) {
      LOG.error({
        'message': 'Error getting wishes',
        'error': err.message
      });
      return;
    }

    LOG.info('[STATUS] [OK] Found ' + _.size(wishes) + ' wishes, Processing.');

    _.each(wishes, function (wish) {

      LOG.info('[STATUS] [OK] Searching for offers containing ' + wish.contains);

      that.db.offers.find({
          $text: {
            $search: wish.contains,
            $language: 'none'
          }
        },
        function (err, offers) {
          if (err) {
            LOG.error({
              'message': 'Error getting offers',
              'error': err.message
            });
            return;
          }

          messenger.sendEmail(wish.email, offers);

          if (wish.phone) {
            messenger.sendSms(wish.phone, offers);
          }
        });
    });
  });
};

Notifier.prototype.start = function (forceMode) {
  var that = this;

  if (forceMode) {
    LOG.info('Running in force mode. No recurring.');
    return that.run(function () {});
  }
  else {
    LOG.info('Running in reccuring mode.', config.notifier.execution.rule);

    var agenda = new Agenda({
      db: {
        address: config.db.uri
      },
      defaultLockLifetime: 10000
    });

    agenda.define('execute notifier', function (job, done) {
      try {
        return that.run(done);
      }
      catch (ex) {
        LOG.error({
          'message': 'Error running notifier',
          'error': ex.message
        });

        done();
      }
    });

    agenda.every(config.notifier.execution.rule, 'execute notifier');

    agenda.start();
  }
};


var notifier = new Notifier();
notifier.start();
