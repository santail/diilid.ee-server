var config = require('./config/environment'),
    activeSites = config.activeSites,
    mongojs = require("mongojs"),
    request = require('request'),
    async = require('async'),
    _ = require('underscore')._,
    cron = require('cron').CronJob;

var Harvester = function () {
    this.db = null;
};

Harvester.prototype.parse = function (originalUrl, parser, body, callback) {
    var that = this,
        runningTime = new Date(),
        deal = {
            'url': originalUrl,
            'site': parser.getSite()
        };

    parser.parseOffer(body, function (parsed) {

        _.extend(deal, parsed);

        _.extend(deal, {
            'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
        });

        that.saveOffer(deal, callback);
    });
};

Harvester.prototype.saveOffer = function (deal, callback) {
    var that = this;

    that.db.offers.save(deal, function (err, saved) {
        if (err || !saved) {
            console.log("Deal not saved", err);
            callback();
        }
        else {
            console.log('Deal saved:', saved);

            if (deal.pictures) {
                console.log('Fetching images:', deal.pictures.length);
                // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, callback);
                callback();
            }
            else {
                callback();
            }
        }
    });
};

Harvester.prototype.processOffers = function (deals, callback) {
    var that = this,
        counter = _.size(deals);

    console.log('total offers found on page: ', counter);

    async.forEachSeries(_.keys(deals), function (offerId, finishItemProcessing) {

        var item = deals[offerId],
            site = item.partners_site_name;

        if (!activeSites[site]) {
            console.log(site + ' not active. skipping ...');
            counter--;
            finishItemProcessing();
            return;
        }

        var Parser = require(__dirname + '/models/' + site + ".js"),
            parser = new Parser();

        var originalUrl = item.url;

        if (originalUrl) {
            console.log('check if deal is already parsed');

            that.db.offers.find({
                url: originalUrl
            }).limit(1).toArray(function (err, deals) {
                if (err) {
                    counter--;
                    console.log('error checking deal ... ');
                    finishItemProcessing();
                    return;
                }

                if (deals.length === 1) {
                    counter--;
                    console.log('deal has been already parsed. skipping ... ');
                    finishItemProcessing();
                }
                else {
                    console.log('waiting request to original deal', originalUrl);

                    request({
                        uri: originalUrl,
                        timeout: 30000
                    }, function (err, response, body) {
                        counter--;

                        console.log('counting: ', counter);

                        if (!(err || response.statusCode !== 200) && body) {
                            that.parse(originalUrl, parser, body, finishItemProcessing);
                        }
                        else {
                            console.log('parsing pakkumised.ee link failed', originalUrl);
                            finishItemProcessing();
                        }
                    });
                }
            });
        }
        else {
            counter--;
            console.log('item has no origin url: ', originalUrl);
            finishItemProcessing();
        }

    }, function (err) {
        if (err) {
            console.log('error reading pakkumised.ee original links', err);
        }
        if (counter === 0) {
            console.log('parsing pakkumised.ee finished successfully');
            callback();
        }
    });
};

Harvester.prototype.run = function () {
    var that = this,
        runningTime = new Date();

    that.db = mongojs.connect(config.db.url, config.db.collections);

    that.db.collection('offers');

    console.log('harvesting started ...', runningTime);

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
            function (callback) {
                pageNumber++;

                var source = 'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';
                console.log('URL: ' + source);

                request({
                    uri: source,
                    timeout: 30000
                }, function (err, response, data) {
                    console.log('Requesting data from pakkumised.ee');

                    if (!(err || response.statusCode !== 200) && data) {
                        console.log('positive response');

                        var deals = parser.parseResponseBody(data);

                        if (!_.isEmpty(deals) && lastId !== _.last(_.keys(deals))) {
                            console.log('not a last page');

                            lastId = _.last(_.keys(deals));

                            console.log('processing offers on page ', pageNumber);

                            that.processOffers(deals, callback);
                        }
                        else {
                            pageRepeats = true;
                            callback();
                        }
                    }
                    else {
                        console.log('Error: ', err);

                        callback(err);
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
    else {
        async.forEachSeries(_.keys(config.activeSites), function (site, finishSiteProcessing) {
            if (config.activeSites[site]) {
                console.log('Site', site, 'is active, and not pakkumised. Harvesting ...');

                var Parser = require(__dirname + '/models/' + site + ".js"),
                    parser = new Parser();
                    parser.setDb(that.db);

                var numberOfLanguages = _.size(parser.config.index),
                    numberOfLanguagesProcessed = 0;

                async.forEachSeries(_.keys(parser.config.index), function (language, finishLanguageProcessing) {
                    var url = parser.config.index[language];

                    console.log("Retrieving index page for", language, url);

                    request({
                        uri: url,
                        timeout: 30000
                    }, function (err, response, data) {
                        console.log('Index page retrieved', response.statusCode);

                        if (!(err || response.statusCode !== 200) && data) {
                            console.log("Parsing index page for", language, url);

                            var body = parser.parseResponseBody(data);
                            var paging = parser.getPagingParameters(body);

                            if (paging) {
                                numberOfLanguagesProcessed++;
                                parser.iteratePages(paging, finishLanguageProcessing);
                            }
                            else {
                                var numberOfOffers = 0,
                                    numberOfOffersProcessed = 0;

                                console.log("Parsing index page for offers links");

                                var links = parser.getOfferLinks(body);
                                numberOfOffers = _.size(links);

                                console.log('Iterating found offers. Total found', numberOfOffers);

                                async.forEachSeries(links, function (link, finishOfferProcessing) {
                                    link = parser.compileProperUrl(parser.config.index[language], link);

                                    console.log('Checking offer', link);

                                    that.db.offers.find({
                                        url: link
                                    }).limit(1).toArray(function (err, offers) {
                                        if (err) {
                                            console.log('Error checking offer', link, err);
                                            numberOfOffersProcessed++;
                                            finishOfferProcessing(err);
                                            return;
                                        }

                                        if (offers.length === 1) {
                                            console.log('Offer', link, 'already exists. Skipped.');
                                            numberOfOffersProcessed++;
                                            finishOfferProcessing();
                                        }
                                        else {
                                            console.log('Retrieving offer', link);
                                            request({
                                                uri: link,
                                                timeout: 30000
                                            }, function (err, response, body) {
                                                numberOfOffersProcessed++;

                                                if (!(err || response.statusCode !== 200) && body) {
                                                    that.parse(link, parser, body, finishOfferProcessing);
                                                }
                                                else {
                                                    console.log('Parsing offer', link, 'failed');
                                                    finishOfferProcessing(err);
                                                }
                                            });
                                        }
                                    });
                                }, function (err) {
                                    if (err) {
                                        console.log('Error retriving offers for', url, err);
                                    }

                                    if (numberOfOffers === numberOfOffersProcessed) {
                                        console.log('Parsing', url, 'finished successfully');
                                        numberOfLanguagesProcessed++;
                                        finishLanguageProcessing(err);
                                    }
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
                        console.log('Error parsing index page', site, err);
                    }

                    if (numberOfLanguages === numberOfLanguagesProcessed) {
                        console.log('Parsing index page', site, 'finished successfully');
                        finishSiteProcessing(err);
                    }
                });
            }
            else {
                finishSiteProcessing();
            }
        }, function (err) {
            if (err) {
                console.log('Error processing sites', err);
            }

            console.log('Harvesting finished');

            that.db.close();
        });
    }
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
