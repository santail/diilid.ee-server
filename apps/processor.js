var LOG = require("./services/Logger"),
  parserFactory = require("./services/ParserFactory"),
  SessionFactory = require("./services/SessionFactory"),
  _ = require('underscore')._,
  util = require("util");

var worker = SessionFactory.getWorkerConnection(['offers_queue']);

worker.register({
  'offer_fetch_event': function offerFetchEventHandler(event, done) {
    var processor = new Processor();

    var options = _.extend(event, {});

    processor.run(options, done);
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

worker.start();

var Processor = function () {
  this.db = SessionFactory.getDbConnection();
};

Processor.prototype.run = function (options, callback) {
  var that = this;

  var id = options.id;

  LOG.profile('Harvester.processOffers');


  that.db.offers.findOne({
    id: id
  }, function findOfferResult(err, offer) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] Checking offer failed', err));
      return callback(err);
    }

    if (offer && options.refresh) {
      that.offerRefresh(offer, callback);
    }
    else if (offer) {
      that.offerReactivate(offer, callback);
    }
    else {
      that.offerFetch(options, callback);
    }
  });
};

Processor.prototype.offerReactivate = function (offer, callback) {
  LOG.debug(util.format('[STATUS] [OK] [%s] [%s] Reactivating offer', offer.site, offer.id));

  this.db.offers.findAndModify({
    query: {
      _id: offer._id
    },
    update: {
      $set: {
        active: true,
        modified: new Date().toISOString()
      }
    },
    'new': false
  }, function offerReactivateResult(err, doc, lastErrorObject) {
    if (err || !doc) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Reactivating offer failed', offer.site, offer.id, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] Reactivating offer finished', offer.site, offer.id));
    return callback(null);
  });
};

Processor.prototype.offerFetch = function (options, callback) {
  LOG.profile('Harvester.processOffer');

  var that = this,
    site = options.site;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Fetching offer', options.site, options.id));

  var parser = parserFactory.getParser(site);

  parser.fetchOffer(options, function (err, offer) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Fetching offer failed', offer.site, offer.id, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] Saving offer', site, parser.getOfferId(offer)));

    that.db.offers.save(offer, function saveOfferResult(err, saved) {
      LOG.profile("Harvester.saveOffer");
      
      if (err || !saved) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Saving offer failed', offer.site, offer.id, err));
        return callback(null);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Saving offer finished', site, parser.getOfferId(saved)));
      return callback(null, saved);
    });
  });
};

Processor.prototype.offerRefresh = function (offer, callback) {
  LOG.profile('Harvester.processOffer');

  var that = this,
    site = offer.site;

  LOG.info(util.format('[STATUS] [OK] [%s] [%s] Refreshing offer', site, offer.id));

  var parser = parserFactory.getParser(site);

  var options = _.extend(offer, {});

  parser.fetchOffer(options, function (err, offer) {
    if (err) {
      LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Refreshing offer failed', offer.site, offer.id, err));
      return callback(null);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] [%s] Updating offer', site, offer.id));

    that.db.offers.findAndModify({
      query: {
        _id: options._id
      },
      update: {
        $set: _.extend(offer, {
          active: true,
          modified: new Date().toISOString()
        })
      },
      'new': false
    }, function offerReactivateResult(err, doc, lastErrorObject) {
      if (err || !doc) {
        LOG.error(util.format('[STATUS] [Failure] [%s] [%s] Updating offer failed', offer.site, offer.id, err));
        return callback(null);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] [%s] Updating offer finished', options.site, options._id));
      return callback(null);
    });
  });
};

module.exports = Processor;
