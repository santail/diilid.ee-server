var config = require('./config/environment'),
  async = require('async'),
  _ = require('underscore')._,
  request = require('request'),
  mongojs = require('mongojs'),
  monq = require('monq'),
  LOG = require("./services/Logger"),
  parserFactory = require("./services/ParserFactory");

var cluster = require('cluster');

if (cluster.isMaster) {
  var numWorkers = require('os').cpus().length;

  console.log('Master cluster setting up ' + numWorkers + ' workers...');

  for (var i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('online', function (worker) {
    console.log('Worker ' + worker.process.pid + ' is online');
  });

  cluster.on('exit', function (worker, code, signal) {
    console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
    console.log('Starting a new worker');
    cluster.fork();
  });
}
else {

  var db = mongojs(config.db.uri, config.db.collections);
  db.collection('offers');

  var client = monq(config.db.uri, {
    safe: true
  });
  var worker = client.worker(['offers_queue']);

  worker.register({
    'offer_update_event': function (params, done) {

      var url = params.link,
        site = params.site,
        language = params.language;

      console.log(process.pid);

      LOG.profile('Harvester.processOffers');

      db.offers.findOne({
        url: url
      }, function (err, offer) {
        if (err) {
          LOG.error({
            'message': 'Error checking offer by url ' + url,
            'error': err.message
          });

          return done(err);
        }

        var parser = parserFactory.getParser(site);

        if (parser.config.reactivate && offer) {
          LOG.debug('Offer #Id', offer._id, offer.url, 'has been already parsed. Reactivating.');

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
          }, function (err, doc, lastErrorObject) {
            if (err) {
              LOG.error({
                'message': 'Error reactivating offer #Id ' + offer._id,
                'error': err.message
              });
            }

            LOG.info('[STATUS] [OK] [', site, '] [', url, '] Offer reactivated');

            return done(err);
          });
        }
        else if (offer) {
          LOG.info('[STATUS] [OK] [', site, '] [', url, '] Offer exists. Skipped.');

          return done();
        }
        else {
          LOG.profile('Harvester.processOffer');

          LOG.debug('Retrieving offer for', site, 'language', language, ':', url);

          async.waterfall([
        function (done) {
                LOG.profile('Retrieve offer');
                request.get(url, {
                  headers: {
                    'accept': "application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
                    'accept-language': 'en-US,en;q=0.8',
                    'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
                  },
                  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
                }, function (err, response, data) {
                  if (err) {
                    LOG.error({
                      'message': 'Error retrieving offer for ' + site + ' language ' + language + ': ' + url,
                      'error': err.message
                    });
                  }

                  LOG.profile('Retrieve offer');

                  done(err, data);
                });
        },
        function (data, done) {
                LOG.profile('Parse offer DOM');

                var parser = parserFactory.getParser(site);

                parser.parseResponseBody(data, function (err, dom) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing response body to DOM',
                      'error': err.message
                    });
                  }

                  LOG.profile('Parse offer DOM');

                  data = null;

                  done(err, dom);
                });
        },
        function (dom, done) {
                LOG.profile("parser.ParseOffer");

                var parser = parserFactory.getParser(site);

                parser.parse(dom, language, function (err, offer) {
                  if (err) {
                    LOG.error({
                      'message': 'Error parsing data for ' + site + ' language ' + language + ': ' + url,
                      'error': err.message
                    });
                  }

                  LOG.profile("parser.ParseOffer");

                  dom = null;

                  return done(err, offer);
                });
        },
        function (offer, done) {
                var runningTime = new Date(),
                  _offer = {
                    'url': url,
                    'site': site,
                    'active': true
                  };

                _.extend(_offer, offer);

                _.extend(_offer, {
                  'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
                });

                offer = null;

                done(null, _offer);
        },
        function (offer, done) {
                LOG.profile("Harvester.saveOffer");

                LOG.debug('Saving offer', offer);

                db.offers.save(offer, function (err, saved) {
                  offer = null;

                  if (err || !saved) {
                    LOG.error({
                      'message': 'Error saving offer',
                      'error': err.message
                    });

                    return done(err);
                  }

                  LOG.info('[STATUS] [OK] [', site, '] [', saved.url, '] Offer saved with id ' + saved._id);

                  LOG.profile("Harvester.saveOffer");

                  return done(null, saved);
                });
        }
       ],
            function (err, saved) {
              LOG.profile('Harvester.processOffer');

              saved = null;

              return done(err);
            });
        }
      });
    }
  });

  worker.on('dequeued', function (data) {
    LOG.debug('Dequeued: ' + data.params.link);
  });

  worker.on('failed', function (data) {
    LOG.error('Failed: ' + data.params.link);
  });

  worker.on('complete', function (data) {
    LOG.debug('Complete: ' + data.params.link);
  });

  worker.on('error', function (err) {
    LOG.error('Error: ' + err);
  });

  worker.start();
}
