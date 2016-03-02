var LOG = require("./services/Logger"),
  parserFactory = require("./services/ParserFactory"),
  Sessionfactory = require("./services/SessionFactory"),
  _ = require('underscore')._,
  util = require("util");

var worker = Sessionfactory.getWorkerConnection(['offers_queue']);

worker.register({
  'offer_fetch_event': function offerFetchEventHandler(event, done) {
    var processor = new Processor();

    var options = _.extend(event, {});

    processor.run(options, done);
  }
});

worker.start();

var Processor = function () {
  this.db = Sessionfactory.getDbConnection();
};

Processor.prototype.run = function (options, callback) {
  var that = this;

  var id = options.id;

  LOG.profile('Harvester.processOffers');

  that.db.offers.findOne({
    id: id
  }, function findOfferResult(err, offer) {
    if (err) {
      LOG.error({
        'message': 'Error checking offer by #id ' + id,
        'error': err.message
      });

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
  LOG.info(util.format('[STATUS] [OK] [%s] Reactivate offer %s', offer.site, offer.id));

  this.db.offers.findAndModify({
    query: {
      _id: offer.id
    },
    update: {
      $set: {
        active: true,
        modified: new Date().toISOString()
      }
    },
    'new': false
  }, function offerReactivateResult(err, doc, lastErrorObject) {
    if (err) {
      LOG.error({
        'message': util.format('Error reactivating offer #Id %s', offer.id),
        'error': err.message
      });
    }

    LOG.info(util.format('[STATUS] [OK] [%s] Reactivated offer %s', offer.site, offer.id));

    return callback(err);
  });
};

Processor.prototype.offerFetch = function (options, callback) {
  LOG.profile('Harvester.processOffer');

  var that = this,
    site = options.site;

  LOG.info(util.format('[STATUS] [OK] [%s] Fetching offer with id %s', options.site, options.id));

  var parser = parserFactory.getParser(site);

  parser.fetchOffer(options, function (err, offer) {
    if (err) {
      LOG.error({
        'message': 'Error fetching offer',
        'error': err.message
      });

      return callback(err);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] Saving offer with id %s', site, parser.getOfferId(offer)));

    that.db.offers.save(offer, function saveOfferResult(err, saved) {
      if (err || !saved) {
        LOG.error({
          'message': 'Error saving offer',
          'error': err
        });

        return callback(err);
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Offer saved with id %s', site, parser.getOfferId(saved)));

      LOG.profile("Harvester.saveOffer");

      return callback(err, saved);
    });
  });
};

Processor.prototype.offerRefresh = function (offer, callback) {
  LOG.profile('Harvester.processOffer');

  var that = this,
    site = offer.site;

  LOG.info(util.format('[STATUS] [OK] [%s] Refreshing offer with id %s', site, offer.id));

  var parser = parserFactory.getParser(site);

  var options = _.extend(offer, {});

  parser.fetchOffer(options, function (err, offer) {
    if (err) {
      LOG.error({
        'message': 'Error fetching offer',
        'error': err.message
      });

      return callback(err);
    }

    LOG.info(util.format('[STATUS] [OK] [%s] Saving offer with id %s', site, parser.getOfferId(offer)));

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
      if (err) {
        LOG.error({
          'message': util.format('Error reactivating offer #Id %s', options._id),
          'error': err.message
        });
      }

      LOG.info(util.format('[STATUS] [OK] [%s] Refreshed offer %s', options.site, options._id));

      return callback(err);
    });
  });
};

module.exports = Processor;
