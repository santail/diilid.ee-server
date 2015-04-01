var config = require('./config/environment'),
  mongojs = require("mongojs"),
  request = require('request'),
  async = require('async'),
  _ = require('underscore')._,
  cron = require('cron').CronJob;

var Harvester = function () {
  this.db = null;
};

Harvester.prototype.parseOffer = function (originalUrl, parser, body, callback) {
  var that = this,
    runningTime = new Date(),
    offer = {
      'url': originalUrl,
      'site': parser.getSite(),
      'active': true
    };

  parser.parseOffer(body, function (err, parsed) {
    if (!err) {
      _.extend(offer, parsed);

      _.extend(offer, {
        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
      });

      that.saveOffer(offer, function (err) {
        if (err) {
          console.log("Error saving offer", err);
        }

        if (offer.pictures) {
          that.processImages(offer.pictures, function (err) {
            if (err) {
              console.log("Error processing offers pictures", err);
            }
            callback(err);
          });
        }
        else {
          callback(err);
        }
      });
    }
    else {
      console.log("Error parsing offer", err);
      callback(err);
    }
  });
};

Harvester.prototype.saveOffer = function (offer, callback) {
  var that = this;

  that.db.offers.save(offer, function (err, saved) {
    if (err || !saved) {
      console.log("Deal not saved", err);
      callback(err);
    }
    else {
      callback();
    }
  });
};

Harvester.prototype.processImages = function (images, callback) {
  console.log('Fetching images:', images.length);
  // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, callback);
  callback();
};

Harvester.prototype.processOffers = function (parser, language, body, callback) {
  var that = this,
    numberOfOffers = 0,
    numberOfOffersProcessed = 0;

  console.log("Parsing index page for offers links");

  var links = parser.getOfferLinks(language, body);
  numberOfOffers = _.size(links);

  console.log('Iterating found offers. Total found', numberOfOffers);

  async.forEachSeries(links, function (originalUrl, finishOfferProcessing) {
    console.log('Checking offer', originalUrl);

    that.db.offers.findOne({
      url: originalUrl
    }, function (err, offer) {
      if (err) {
        console.log('Error checking offer by url', originalUrl);
        numberOfOffersProcessed++;
        finishOfferProcessing(err);
        return;
      }

      if (offer) {
        console.log('Offer', originalUrl, 'has been already parsed. Reactivating.');
        // find one named 'mathias', tag him as a contributor and return the modified doc
        that.db.offers.findAndModify({
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
            console.log('Error reactivating offer #Id', offer._id);
          }

          numberOfOffersProcessed++;
          finishOfferProcessing();
        });
      }
      else {
        console.log('Retrieving offer', originalUrl);
        request({
          uri: originalUrl,
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
          }
        }, function (err, response, body) {
          numberOfOffersProcessed++;

          if (!(err || response.statusCode !== 200) && body) {
            that.parseOffer(originalUrl, parser.getValidParser(originalUrl), body, finishOfferProcessing);
          }
          else {
            console.log('Parsing offer', originalUrl, 'failed');
            finishOfferProcessing(err);
          }
        });
      }
    });
  }, function (err) {
    if (err) {
      callback(err, links);
    }
    else {
      if (numberOfOffers === numberOfOffersProcessed) {
        callback(err, links);
      }
    }
  });
};

Harvester.prototype.processPage = function (page, parser, language, url, finishPageProcessing) {
  var that = this;

  console.log('Requesting page', page);

  request({
    uri: page,
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }
  }, function (err, response, data) {
    console.log('Page', page, 'retrieved', response.statusCode);

    if (!(err || response.statusCode !== 200) && data) {
      var body = parser.parseResponseBody(data);

      that.processOffers(parser, language, body, function (err) {
        if (err) {
          console.error(err);
        }

        finishPageProcessing(err);
      });
    }
    else {
      console.log('Error retrieving index page for', language, url, response.statusCode, err);
      finishPageProcessing(err);
    }
  });
};

Harvester.prototype.processSite = function (parser, callback) {
  var that = this;

  var numberOfLanguages = _.size(parser.config.index),
    numberOfLanguagesProcessed = 0;

  async.forEachSeries(_.keys(parser.config.index), function (language, finishLanguageProcessing) {
    var url = parser.config.index[language];

    console.log("Retrieving index page for", language, url);

    request({
      uri: url,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      }
    }, function (err, response, data) {
      console.log('Index page retrieved', response.statusCode);

      if (!(err || response.statusCode !== 200) && data) {
        console.log("Parsing index page for", language, url);

        var body = parser.parseResponseBody(data);
        var paging = parser.getPagingParameters(language, body);

        if (paging) {
          var numberOfPages = 0,
            numberOfPagesProcessed = 0;

          var pages = paging.pages;
          numberOfPages = _.size(pages);

          async.forEachSeries(pages, function (page, finishPageProcessing) {
            that.processPage(page, parser, language, url, function (err) {
              numberOfPagesProcessed++;
              finishPageProcessing(err);
            });
          }, function (err) {
            if (err) {
              console.log('Error retriving offers for', url, err);
              finishLanguageProcessing(err);
            }

            if (numberOfPages === numberOfPagesProcessed) {
              console.log('Parsing', url, 'finished successfully');
              numberOfLanguagesProcessed++;
              finishLanguageProcessing(err);
            }
          });
        }
        else {
          that.processOffers(parser, language, body, function (err) {
            if (err) {
              console.log('Error retriving offers for', url, err);
            }
            else {
              console.log('IndexParsing', url, 'parsed successfully');
            }

            numberOfLanguagesProcessed++;
            finishLanguageProcessing(err);
          });
        }
      }
      else {
        console.log('Error retrieving index page for', language, url, response.statusCode, err);
        numberOfLanguagesProcessed++;
        finishLanguageProcessing(err);
      }
    });
  }, function (err) {
    if (err) {
      callback(err);
    }
    else {
      if (numberOfLanguages === numberOfLanguagesProcessed) {
        callback();
      }
    }
  });
};

Harvester.prototype.run = function () {
  var that = this,
    runningTime = new Date();

  that.db = mongojs.connect(config.db.url, config.db.collections);

  that.db.collection('offers');

  console.log('harvesting started', runningTime);

  if (!!config.pakkumised) {
    var pageNumber = 0,
      pageRepeats = false,
      lastId = null;

    var PakkumisedParser = require(__dirname + '/models/pakkumised.ee.js'),
      parser = new PakkumisedParser();

    async.whilst(
      function () {
        return !pageRepeats;
      },
      function (finishPageProcessing) {
        pageNumber++;

        var page = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';
        console.log('URL: ' + page);

        request({
          uri: page,
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
          }
        }, function (err, response, data) {
          console.log('Requesting data from pakkumised.ee');

          if (!(err || response.statusCode !== 200) && data) {
            console.log('positive response');

            that.processOffers(parser, 'est', data, function (err, deals) {
              if (err) {
                console.error(err);
              }

              if (!_.isEmpty(deals) && lastId !== _.last(_.keys(deals))) {
                console.log('not a last page');

                lastId = _.last(_.keys(deals));

                console.log('processing offers on page ', pageNumber);
              }
              else {
                pageRepeats = true;
              }

              finishPageProcessing(err);
            });
          }
          else {
            console.log('Error: ', err);

            finishPageProcessing(err);
          }
        });
      },
      function (err) {
        if (err) {
          console.log('There was an error: ', err);
        }
        else {
          console.log('Finished');
        }

        that.db.close();
      }
    );
  }

  async.forEachSeries(_.keys(config.activeSites), function (site, finishSiteProcessing) {
    if (config.activeSites[site]) {
      console.log('Site', site, 'is active. Harvesting.');

      var Parser = require(__dirname + '/models/' + site + ".js"),
        parser = new Parser();

      if (parser.config.reactivate) {
        console.log('Deactivating offers for site', site);

        that.db.offers.update({
          'site': site
        }, {
          $set: {
            active: false
          }
        }, {
          'multi': true,
          'new': false
        }, function (err) {
          if (err) {
            console.log('Error deactivating offers for site', site, err);
          }

          that.processSite(parser, function (err) {
            that.onSiteProcessed(err, site, finishSiteProcessing);
          });
        });
      }
      else {
        that.processSite(parser, function (err) {
          that.onSiteProcessed(err, site, finishSiteProcessing);
        });
      }
    }
    else {
      console.log('Site', site, 'is switched off. Skipped.');
      finishSiteProcessing();
    }
  }, function (err) {
    if (err) {
      console.log('Harvesting failed', err);
    }
    else {
      console.log('Harvesting finished');
    }

    that.db.close();
  });
};

Harvester.prototype.onSiteProcessed = function (err, site, callback) {
  if (err) {
    console.log('Error processing site', site);
  }
  else {
    console.log('Processing site', site, 'finished successfully');
  }

  callback(err);
};

Harvester.prototype.start = function (forceMode) {
  if (forceMode) {
    this.run();
  }
  else {
    new cron(config.harvester.execution.rule, this.run, null, true, "Europe/Tallinn");
  }
};

module.exports = Harvester;
