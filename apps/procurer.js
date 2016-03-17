var
async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  util = require("util"),
  Sessionfactory = require("./services/SessionFactory");

var worker = Sessionfactory.getWorkerConnection(['offers_queue']);

worker.register({
  'procurer_run_event': function procurerRunEventHandler(event, done) {
    var procurer = new Procurer();

    var options = _.extend(event, {});

    procurer.run(options, done);
  }
});

worker.register({
  'wish_procure_event': function procurerRunEventHandler(event, done) {
    var procurer = new Procurer();

    var options = _.extend(event, {});

    procurer.processWish(options, done);
  }
});

worker.start();

var Procurer = function () {
  this.db = Sessionfactory.getDbConnection();
  this.queue = Sessionfactory.getQueueConnection('offers_queue');
};

Procurer.prototype.run = function (options, callback) {
  var that = this;

  LOG.info(util.format('[STATUS] [OK] Gathering wishes'));

  that.db.wishes.aggregate([
      {
        $group: {
          _id: "$email",
          wishes: {
            $push: "$$ROOT"
          }
        }
    }
   ],
    function (err, wishes) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] Gathering wishes failed', err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] Gathering wishes finished. Found %s', _.size(wishes)));
      return that.aggregateResult(wishes, callback);
    });
};

Procurer.prototype.aggregateResult = function aggregateResult(res, callback) {
  var that = this;

  _.each(res, function iterateResult(result) {

    var email = result._id,
      wishes = result.wishes;

    LOG.info(util.format('[STATUS] [OK] [%s] Processing wishes. Found %d', email, _.size(wishes)));

    var functions = _.map(wishes, function (wish) {
      return function (done) {
        that.processWish(wish, done);
      };
    });

    async.series(functions, function (err, notifications) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] Processing wishes failed', email, err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Processing wishes finished', email));
      return callback();
    });
  });
};

Procurer.prototype.processWish = function (options, callback) {
  var that = this;

  LOG.info(util.format('[STATUS] [OK] Fetching offers for "%s"', options.contains));

  that.db.offers.find({
      $text: {
        $search: options.contains,
        $language: options.language
      },
      active: true
    },
    function (err, offers) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] Fetching offers for "%s" failed', options.contains, err));
        return callback();
      }

      LOG.info(util.format('[STATUS] [OK] Fetching offers for "%s" finished. Found %s', options.contains, _.size(offers)));

      if (_.size(offers) === 0) {
        return callback();
      }

      var notification = {
        email: options.email,
        contains: options.contains,
        offers: offers
      };

      if (options.phone) {
        notification.phone = options.phone;
      }

      that.queue.enqueue('notification_send_event', notification, function (err, job) {
        if (err) {
          LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Enqueuing notification failed', notification.email, notification.contains, err));
          return callback(err);
        }

        LOG.info(util.format('[STATUS] [OK] [%s] [%s] Enqueuing notification finished', notification.email, notification.contains));
        return callback();
      });
    });
};


module.exports = Procurer;
