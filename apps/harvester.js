var config = require('./config/environment'),
    activeSites = config.activeSites,
    db = require("mongojs").connect(config.db.url, config.db.collections),
    request = require('request'),
    async = require('async'),
    _ = require('underscore')._,
    cron = require('cron').CronJob;

new cron('*/5 * * * * *', function() {
    console.log('You will see this message every 5 seconds');

    var runningTime = new Date();

    console.log('harvesting started ...', runningTime);

    var pageNumber = 0,
        pageRepeats = false,
        lastId = null;

    async.whilst(
        function () { return !pageRepeats; },
        function (callback) {
            pageNumber++;

            var source =  'http://pakkumised.ee/acts/offers/js_load.php?act=offers.js_load&category_id=0&page=' + pageNumber + '&keyword=';
            console.log('URL: ' + source);

            request({
                uri: source,
                timeout: 30000
            }, function (err, response, data) {
                console.log('Requesting data from pakkumised.ee');

                if (!(err || response.statusCode !== 200) && data) {
                    console.log('positive response');

                    var deals = JSON.parse(data),
                        counter = _.size(deals);

                    if (!_.isEmpty(deals) && lastId !== _.last(_.keys(deals))) {
                        console.log('not a last page');

                        lastId = _.last(_.keys(deals));

                        console.log('total offers found on page: ', counter);

                        async.forEachSeries(_.keys(deals), function (offerId, finishItemProcessing) {
                            console.log('processing offers on page ', pageNumber);

                            var item = deals[offerId],
                                site = item.partners_site_name;

                            if (!activeSites[site]) {
                                console.log(site + ' not active. skipping ...');
                                counter--;
                                finishItemProcessing();
                                return;
                            }

                            var originalUrl = item.url;

                            console.log('waiting to pakkumised.ee source request', originalUrl);

                            if (originalUrl) {
                                console.log('check if deal is already parsed');

                                db.offers.find({url: originalUrl}).limit(1).toArray(function (err, deals) {
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
                                                var deal = {
                                                    'url': originalUrl,
                                                    'site': site
                                                },
                                                parser = require(__dirname + '/models/' + site + ".js");

                                                parser.parse(body, function (parsed) {

                                                    _.extend(deal, parsed);

                                                    _.extend(deal, {
                                                        'parsed': runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
                                                    });

                                                    db.offers.save(deal, function (err, saved) {
                                                        if (err || !saved) {
                                                            console.log("Deal not saved", err);
                                                            finishItemProcessing();
                                                        }
                                                        else {
                                                            console.log('Deal saved:', saved);

                                                            if (deal.pictures) {
                                                                console.log('Fetching images:', deal.pictures.length);
                                                                // imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, finishItemProcessing);
                                                                finishItemProcessing();
                                                            }
                                                            else {
                                                                finishItemProcessing();
                                                            }
                                                        }
                                                    });
                                                });
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

                                console.log(_.isEmpty(deals), _.last(_.keys(deals)), pageNumber);

                                callback();
                            }
                        });
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
        }
    );
}, null, true, "America/Los_Angeles");

