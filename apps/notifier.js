'use strict';

var Messenger = require("./services/Messenger"),
  LOG = require("./services/Logger"),
  SessionFactory = require("./services/SessionFactory"),
  _ = require("underscore")._,
  util = require("util");

var worker = SessionFactory.getWorkerConnection(['offers_queue']);

worker.register({
  'notification_send_event': function notificationSendEventHandler(event, done) {
    var notifier = new Notifier();

    var options = _.extend(event, {});

    notifier.run(options, done);
  }
});

worker.on('complete', function (data) { 
  SessionFactory.getDbConnection().jobs.remove({_id: data._id}, function (err, lastErrorObject) {
    if (err) {
      LOG.debug(util.format('[STATUS] [Failure] Removing event failed', err));
      return;
    }
  });
});

worker.on('complete', function (data) { 
  SessionFactory.getDbConnection().jobs.remove({_id: data._id}, function (err, lastErrorObject) {
    if (err) {
      LOG.debug(util.format('[STATUS] [Failure] Removing event failed', err));
      return;
    }
  });
});

worker.start();

var Notifier = function () {
};

Notifier.prototype.run = function (options, callback) {
  var messenger = new Messenger();
  messenger.send(options, callback);
};

module.exports = Notifier;
