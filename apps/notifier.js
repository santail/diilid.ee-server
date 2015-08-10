'use strict';

var config = require('./config/environment'),
  _ = require('underscore')._,
  Agenda = require("agenda"),
  Messenger = require("./services/Messenger"),
  LOG = require("./services/Logger");

require('nodetime').profile({
  accountKey: 'ddd532b852f953c005e71b17c4cfb79b640faa77',
  appName: 'SalesTracker-Notifier'
});

var Notifier = function () {
  this.db = null;
};

Notifier.prototype.run = function () {
  var that = this,
    messenger = new Messenger();

  that.db = require('mongojs').connect(config.db.uri, config.db.collections);
  that.db.collection('wishes');

  that.db.wishes.find(function (err, wishes) {
    if (err) {
      console.log('Error retrieving wishes');
    }

    console.log('Found', _.size(wishes), 'wishes, Processing');

    _.each(wishes, function (wish) {

      console.log('Searching for offers containing', wish.contains);

      that.db.offers.find({
          $text: {
            $search: wish.contains,
            $language: wish.language
          }
        },
        function (err, offers) {
          if (err) {

          }

          messenger.sendEmail(wish.email, offers);

          if (wish.hasPhone) {
            messenger.sendSms(wish.phone, offers);
          }

          that.db.close();
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

module.exports = Notifier;
