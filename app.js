/**
 * Module dependencies.
 */
var express = require('express')
    , routes = require('./routes')
    , request = require('request')
    , url = require('url')
    , urlify = require('urlify').create({
        trim: true
    })
    , thumbbot = require('thumbbot')
    , jsdom = require('jsdom')
    , async = require('async')
    , _ = require('underscore')._
    , http = require('http')
    , fs = require('fs')
    , exec = require('child_process').exec

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

var config = require('./configs/conf.' + app.settings.env + '.js')
    , db = require("mongojs").connect(config.db.url, config.db.collections)
    , imageProcessor = require('./services/ImageProcessor.service.js')

// Routes

app.get('/', routes.index);
app.get('/deals', function(req, res) {
    var runningTime = new Date();
    console.log('checking fresh parsed links exist')

    db.offers.find({
        parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()
    }, function(err, offers) {
        if (err || !offers) {
            console.log('fresh links missing', err)
        }
        else {
            console.log('fresh links exist')

            var list = []

            offers.forEach(function (offer) {
                delete offer.href
                list.push(offer)
            });

            res.json({
                total: list.length
                , items: list
            })
        }
    })
})

app.get('/refresh', function (req, res) {
    req.connection.setTimeout(600000);

    var counter = 0
        , deals = []
        , result = {}
        , runningTime = new Date()

    console.log('harvesting...')

    fetchPage('http://pakkumised.ee', function ($) {
        deals = $('body').find('.offers-list li')

        result.total = counter = deals.length
        result.items = []

        console.log('Deals total: ', deals.length)

        async.series([
            function (finishFirstStep) {
                async.forEachSeries(deals, function (item, finishItemProcessing) {
                    var site = $(item).children('span.site-name').text()
                        , title = $(item).find('h3').attr('title').trim()
                        , link = $(item).find('h3').children('a').attr('href')

                    console.log('waiting to pakkumised.ee source request', link)

                    request({
                        uri: link
                    }, function (err, response, body) {
                        console.log('counting pakkumised.ee link: ', counter)

                        if (!(err || response.statusCode !== 200) && body) {
                            parsePage(body, function($) {
                                var originalUrl = $('iframe.offerpage_content').attr('src')

                                if (originalUrl) {
                                    console.log('waiting request to original deal', originalUrl)

                                    request({
                                        uri: originalUrl,
                                        timeout: 30000
                                    }, function (err, response, body) {
                                        counter--;

                                        console.log('counting: ', counter);

                                        if (!(err || response.statusCode !== 200) && body) {
                                            parsePage(body, function($) {

                                                var deal = {
                                                    url: url.parse(originalUrl)
                                                    , site: site
                                                };

                                                var parsedUrl = url.parse(originalUrl);
                                                deal.url = {
                                                    href: parsedUrl.href
                                                    , host: parsedUrl.host
                                                    , hostname: parsedUrl.hostname
                                                    , pathname: parsedUrl.pathname
                                                }

                                                _.extend(deal, require(__dirname + '/models/' + site + ".js"))
                                                _.extend(deal, {
                                                    parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()
                                                })

                                                db.offers.save(deal, function(err, saved) {
                                                    if( err || !saved ) {
                                                        console.log("Deal not saved", err);
                                                        finishItemProcessing()
                                                    }
                                                    else {
                                                        console.log('Deal saved:', saved);
                                                        result.items.push(saved);

                                                        if (deal.pictures) {
                                                            console.log('Fetching images:', deal.pictures.length)
                                                            imageProcessor.process(config.images.dir + saved._id + '/', deal.pictures, finishItemProcessing)
                                                        }
                                                        else {
                                                            finishItemProcessing()
                                                        }
                                                    }
                                                });
                                            });
                                        }
                                        else {
                                            console.log('parsing pakkumised.ee link failed', link)
                                            finishItemProcessing()
                                        }
                                    });
                                }
                                else {
                                    counter--
                                    console.log('item has no origin url: ', link)
                                    finishItemProcessing()
                                }
                            });
                        }
                        else {
                            counter--
                            console.log('parsing pakkumised.ee link finished with error', link, err)
                            finishItemProcessing()
                        }
                    });

                }, function(err) {
                    if (err) {
                        console.log('error reading pakkumised.ee original links', err)
                    }
                    if (counter === 0) {
                        console.log('parsing pakkumised.ee finished successfully')
                        finishFirstStep(null, 'one');
                    }
                })

                console.log('perform first iteration')
            }
        ],
            function (err) {
                console.log('processing done')
                if (err) {
                    console.log('error during process', err)
                }

                res.json(result);
            });
    });
});

var parsePage = function (body, parser) {
    jsdom.env({
        html:body,
        scripts:['http://code.jquery.com/jquery-1.6.min.js']
    }, function (err, window) {

        if (!err) {
            parser(window.jQuery);
        }
        else {
            console.log('Error: ', err);
        }
    });
};

var fetchPage = function (source, processor) {
    request({
        uri:source,
        timeout: 30000
    }, function (err, response, body) {
        if (!(err || response.statusCode !== 200) && body) {
            parsePage(body, processor);
        }
        else {
            console.log('Error: ', err);
        }
    });
};

app.listen(config.app.port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
