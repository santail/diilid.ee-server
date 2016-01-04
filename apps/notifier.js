'use strict';

var config = require('./config/env'),
  util = require("util"),
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

    LOG.info(util.format('[STATUS] [OK] Found %d wishes. Processing.', _.size(wishes)));

    _.each(wishes, function (wish) {

      LOG.info(util.format('[STATUS] [OK] Searching for offers containing "%s"', wish.contains));

      that.db.offers.find({
          $text: {
            $search: wish.contains,
            $language: wish.language
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

          if (_.size(offers) === 0) {
            LOG.info(util.format('[STATUS] [OK] No offers containing "%s" found', wish.contains));
            return;
          }

          LOG.info(util.format('[STATUS] [OK] %d offers containing "%s" found', _.size(offers), wish.contains));

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
