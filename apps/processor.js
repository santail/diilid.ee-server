var config = require('./config/env'),
  async = require('async'),
  _ = require('underscore')._,
  request = require('request'),
  mongojs = require('mongojs'),
  monq = require('monq'),
  LOG = require("./services/Logger"),
  parserFactory = require("./services/ParserFactory");


var db = mongojs(config.db.uri, config.db.collections);

var client = monq(config.db.uri, { safe: true });
var worker = client.worker(['offers_queue']);

worker.register({
  'offer_update_event': function handleOfferUpdateEvent(event, done) {

    var id = event.id,
      site = event.site;

    var parser = parserFactory.getParser(site);

    LOG.profile('Harvester.processOffers');

    db.offers.findOne({
      id: id
    }, function findOfferResult(err, offer) {
      if (err) {
        LOG.error({
          'message': 'Error checking offer by #id ' + id,
          'error': err.message
        });

        return done(err);
      }

      if (parser.config.reactivate && offer) {
        LOG.info('Offer #Id', offer._id, offer.id, 'has been already parsed. Reactivating.');

        db.offers.findAndModify({
          query: {
            _id: offer._id
          },
          update: {
            $set: {
              active: true
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

          return done(err);
        });
      }
      else if (offer) {
        LOG.info('[STATUS] [OK] [', site, '] [', id, '] Offer exists. Skipped.');

        return done();
      }
      else {
        LOG.profile('Harvester.processOffer');

        parser.fetchOffer(event, function (err, offer) {
          if (err) {
            LOG.error({
              'message': 'Error fetching offer',
              'error': err.message
            });

            return done(err);
          }

          LOG.info('[STATUS] [OK] [', site, '] Saving offer with id ', parser.getOfferId(offer));

          db.offers.save(offer, function saveOfferResult(err, saved) {
            if (err || !saved) {
              LOG.error({
                'message': 'Error saving offer',
                'error': err
              });

              return done(err);
            }

            LOG.info('[STATUS] [OK] [', site, '] Offer saved with id ', parser.getOfferId(saved));

            LOG.profile("Harvester.saveOffer");

            return done(err, saved);
          });
        });
      }
    });
  }
});

worker.on('dequeued', function onDequeued(data) {
  LOG.debug('Dequeued: ' + data.params.link);
});

worker.on('failed', function onFailed(data) {
  LOG.error('Failed: ' + data.params.link);
});

worker.on('complete', function onComplete(data) {
  LOG.debug('Complete: ' + data.params.link);
});

worker.on('error', function onError(err) {
  LOG.error('Error: ' + err);
});

worker.start();
