'use strict';

var Messenger = require("./services/Messenger"),
  LOG = require("./services/Logger"),
  Sessionfactory = require("./services/SessionFactory"),
  _ = require("underscore")._;


var worker = Sessionfactory.getWorkerConnection(['offers_queue']);

worker.register({
  'notification_send_event': function notificationSendEventHandler(event, done) {
    var notifier = new Notifier();

    var options = _.extend(event, {});

    notifier.run(options, done);
  }
});

worker.start();

var Notifier = function () {
};

Notifier.prototype.run = function (options, callback) {
  var messenger = new Messenger();
  messenger.send(options, callback);
};

module.exports = Notifier;
