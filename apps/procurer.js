var
async = require('async'),
  _ = require('underscore')._,
  LOG = require("./services/Logger"),
  util = require("util"),
  Sessionfactory = require("./services/SessionFactory"),
  elasticsearch = require('elasticsearch');

var elasticClient = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'info'
});

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
    function (err, result) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] Gathering wishes failed', err));
        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] Gathering wishes finished. Found %s', _.size(result)));
      return that.aggregateResult(result, callback);
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

Procurer.prototype.processWish = function (wish, callback) {
  var that = this;

  LOG.info(util.format('[STATUS] [OK] [%s] Fetching offers for "%s"', wish.language, wish.contains));

  elasticClient.search({
    index: 'deals',
    type: 'offer',
    body: {
      "query": {
        "filtered": {
          "query": {
            "multi_match": {
              "query": wish.contains,
              "type": "best_fields",
              "fields": ["title"]
            }
          },
          "filter": {
            "bool": {
              "must": [{
                  "term": {
                    "language": wish.language,
                  }
                }, {
                "term": {
                  "active": true
                }
              }]
            }
          }
        }
      },
      "highlight": {
        "fields": {
          "title": {}
        }
      }
    }
  }, function (error, response) {
    console.log(response);

    var notification = {
      email: wish.email,
      contains: wish.contains
    };

    if (wish.phone) {
      notification.phone = wish.phone;
    }

    if (response.hits.total === 0) {
      return callback();
    }

    notification.offers = response.hits.hits;

    that.queue.enqueue('notification_send_event', notification, function (err, job) {
      if (err) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Enqueuing notification failed', notification.email, notification.contains, err));
        return callback();
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Enqueuing notification finished', notification.email, notification.contains));
      return callback();
    });


    console.log(response.hits.hits[0] ? response.hits.hits[0]._source : '');
  });
};

module.exports = Procurer;
