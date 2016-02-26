var
  async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  util = require("util"),
  Sessionfactory = require("./services/SessionFactory");

var Procurer = function () {
  this.db = Sessionfactory.getDbConnection();
  this.queue = Sessionfactory.getQueueConnection('offers_queue');
};

Procurer.prototype.run = function (options, callback) {
  var that = this;

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
    function (err, res) {

      if (err) {
        LOG.error({
          'message': 'Error getting wishes',
          'error': err.message
        });

        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] Found %d requests. Processing.', _.size(res)));

      return that.aggregateResult(res, callback);
    });
};

Procurer.prototype.aggregateResult = function aggregateResult(res, callback) {
  var that = this;

  _.each(res, function iterateResult(result) {

    var email = result._id,
      wishes = result.wishes;

    LOG.info(util.format('[STATUS] [OK] Found %d wishes for %s. Processing.', _.size(wishes), email));

    var functions = _.map(wishes, function (wish) {
      return function (done) {
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
              return done(err);
            }

            if (_.size(offers) === 0) {
              LOG.info(util.format('[STATUS] [OK] No offers containing "%s" found', wish.contains));
              return done();
            }

            LOG.info(util.format('[STATUS] [OK] %d offers containing "%s" found', _.size(offers), wish.contains));

            var notification = {
              email: email,
              contains: wish.contains,
              offers: offers
            };

            if (wish.phone) {
              notification.phone = wish.phone;
            }

            that.queue.enqueue('notification_send_event', notification, function (err, job) {
              if (err) {
                LOG.error({
                  'message': 'Error enqueueing notification',
                  'error': err.message
                });

                return callback(err);
              }

              LOG.info('[STATUS] [OK] Notification enqueued for processing');

              return callback();
            });

            done(null, notification);
          });
      };
    });

    async.series(functions, function (err, notifications) {
      if (err) {
        LOG.error({
          'message': 'Error enqueueing offers for site ',
          'error': err.message
        });

        return callback(err);
      }

      return callback();
    });
  });
};


module.exports = Procurer;
