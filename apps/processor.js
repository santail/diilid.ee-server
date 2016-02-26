var LOG = require("./services/Logger"),
  parserFactory = require("./services/ParserFactory"),
  Sessionfactory = require("./services/SessionFactory");


var Processor = function () {
  this.db = Sessionfactory.getDbConnection();
};

Processor.prototype.run = function (options, callback) {
  var that = this;

  var id = options.id,
    site = options.site;

  var parser = parserFactory.getParser(site);

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

    if (parser.config.reactivate && offer) {
      LOG.info('Offer #Id', offer._id, offer.id, 'has been already parsed. Reactivating.');

      that.db.offers.findAndModify({
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
      }, function modifyOfferResult(err, doc, lastErrorObject) {
        if (err) {
          LOG.error({
            'message': 'Error reactivating offer #Id ' + offer._id,
            'error': err.message
          });
        }

        LOG.info('[STATUS] [OK] [', site, '] [', id, '] Offer reactivated');

        return callback(err);
      });
    }
    else if (offer) {
      LOG.info('[STATUS] [OK] [', site, '] [', id, '] Offer exists. Skipped.');

      return callback();
    }
    else {
      LOG.profile('Harvester.processOffer');

      parser.fetchOffer(options, function (err, offer) {
        if (err) {
          LOG.error({
            'message': 'Error fetching offer',
            'error': err.message
          });

          return callback(err);
        }

        LOG.info('[STATUS] [OK] [', site, '] Saving offer with id ', parser.getOfferId(offer));

        that.db.offers.save(offer, function saveOfferResult(err, saved) {
          if (err || !saved) {
            LOG.error({
              'message': 'Error saving offer',
              'error': err
            });

            return callback(err);
          }

          LOG.info('[STATUS] [OK] [', site, '] Offer saved with id ', parser.getOfferId(saved));

          LOG.profile("Harvester.saveOffer");

          return callback(err, saved);
        });
      });
    }
  });
};

module.exports = Processor;
