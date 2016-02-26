'use strict';

var Messenger = require("./services/Messenger"),
  LOG = require("./services/Logger");

var Notifier = function () {
};

Notifier.prototype.run = function (options, callback) {
  var messenger = new Messenger();
  messenger.send(options, callback);
};

module.exports = Notifier;
