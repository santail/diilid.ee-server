var
  LOG = require("./services/Logger"),
  Harvester = require("./harvester"),
  Notifier = require("./notifier"),
  Processor = require("./processor"),
  Procurer = require("./procurer"),
  Sessionfactory = require("./services/SessionFactory"),
  _ = require("underscore")._;

var worker = Sessionfactory.getWorkerConnection(['offers_queue']);

worker.register({
  'offer_fetch_event': function offerFetchEventHandler(event, done) {
    var processor = new Processor();

    var options = {};

    processor.run(options, done);
  }
});

worker.register({
  'procurer_run_event': function procurerRunEventHandler(event, done) {
    var procurer = new Procurer();

    var options = {};

    procurer.run(options, done);
  }
});

worker.register({
  'notification_send_event': function notificationSendEventHandler(event, done) {
    var notifier = new Notifier();

    var options = _.extend(event, {});

    notifier.run(options, done);
  }
});

worker.register({
  'harvester_run_event': function harvesterRunEventHandler(event, done) {
    var harvester = new Harvester();

    var options = {
      "site": event.site
    };

    harvester.run(options, done);
  }
});

worker.start();
