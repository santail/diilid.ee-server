/**
 * Module dependencies.
 */
var env = process.env.NODE_ENV || 'development', 
    config = require('./configs/conf.' + env),
    db = require("mongojs").connect(config.db.url, config.db.collections),
    express = require('express')
    , routes = require('./routes')
    , request = require('request')
    , cheerio = require('cheerio')
    , url = require('url')
    , urlify = require('urlify').create({
        trim: true
    })
    , pakkumised = require('pakkumised')
    , thumbbot = require('thumbbot')
    , async = require('async')
    , _ = require('underscore')._
    , http = require('http')
    , fs = require('fs'),
    imageProcessor = require('./services/ImageProcessor.service.js'), 
    exec = require('child_process').exec

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

// Routes

app.get('/', routes.index);
app.get('/deals', function(req, res) {
    var runningTime = new Date()
        , jsonPCallback = req.param('result', 'callback')
        , result = {}

    console.log('checking fresh parsed links exist')

    db.offers.find({
        parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
    }, function(err, offers) {
        res.writeHead(200, { 'Content-Type': 'text/javascript' })

        if (err || !offers) {
            console.log('fresh links missing', err)
            result = {
                success: false
                , message: 'No fresh offers found'
            }
        }
        else {
            console.log('fresh links exist')
            var list = []

            offers.forEach(function (offer) {
                delete offer.href
                list.push(offer)
            });

            result = {
                success: true
                , total: list.length
                , items: list
            }
        }

        res.end(jsonPCallback + '(' + JSON.stringify(result) + ')');
    })
})

app.get('/refresh', function (req, res) {
    req.connection.setTimeout(600000);

    var counter = 0
        , deals = []
        , result = {}
        , runningTime = new Date()
        , jsonPCallback = req.param('result', 'callback')

    console.log('harvesting...')

    fetchPage('http://pakkumised.ee', function ($) {
        deals = $('body').find('.offers-list li')

        counter = deals.length
        result.items = []

        console.log('Deals total: ', deals.length)

        async.series([
            function (finishFirstStep) {
                async.forEachSeries(deals, function (item, finishItemProcessing) {
                    var site = $(item).children('span.site-name').text()
                        , title = $(item).find('h3').attr('title').trim()
                        , link = $('<div />').html($(item).find('h3').children('a').attr('href')).text()

                    console.log('waiting to pakkumised.ee source request', link )

                    request({
                        uri: link
                    }, function (err, response, body) {
                        console.log('counting pakkumised.ee link: ', counter)

                        if (!(err || response.statusCode !== 200) && body) {
                            var $ = cheerio.load(body)
                                , frame = $('iframe.offerpage_content')

                            if (frame.length === 0) {
                                console.log('Some strange content. Skipping ...');
                                finishItemProcessing() 
                                return
                            }

                            var originalUrl = $('<div />').html(frame.attr('src')).text()

                            console.log(originalUrl)

                            if (originalUrl) {
                                console.log('waiting request to original deal', originalUrl)

                                request({
                                    uri: originalUrl,
                                    timeout: 30000
                                }, function (err, response, body) {
                                    counter--;

                                    console.log('counting: ', counter);

                                    if (!(err || response.statusCode !== 200) && body) {
                                        var deal = {
                                                url: url.parse(originalUrl)
                                                , site: site
                                            }

                                        _.extend(deal, pakkumised.parse(cheerio.load(body), site))
                                        _.extend(deal, {
                                            parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getFullYear()
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
                if (!err) {
                    result.success = true
                    result.total = result.items.length
                }
                else {
                    result.success = false
                    console.log('error during process', err)
                }

                res.writeHead(200, { 'Content-Type': 'text/javascript' })
                res.end(jsonPCallback + '(' + JSON.stringify(result) + ')');
            });
    });
});

var fetchPage = function (source, processor) {
    request({
        uri:source,
        timeout: 30000
    }, function (err, response, body) {
        if (!(err || response.statusCode !== 200) && body) {
            processor(cheerio.load(body))
        }
        else {
            console.log('Error: ', err);
        }
    });
};

app.listen(process.env.PORT, process.env.IP);
console.log('Express server started on port %s', process.env.PORT);
