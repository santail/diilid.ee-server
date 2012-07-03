var jitsuDb = "mongodb://nodejitsu:350c51a0cffb3a650f7113bd18a48e9e@flame.mongohq.com:27050/nodejitsudb122637634597";

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
    , db = require("mongojs").connect("deals", ["offers"])

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
                total: list.length,
                items: list
            })
        }
    });
})
app.get('/refresh', function (req, res) {
    req.connection.setTimeout(600000);

    var counter = 0, processing = 0, deals = [], result = {}, runningTime = new Date();

    console.log('harvesting...')

    fetchPage('http://pakkumised.ee', function ($) {
        deals = $('body').find('.offers-list li');

        result.total = counter = deals.length;
        result.items = [];

        console.log('Deals total: ', deals.length);

        async.series([
            function (finishFirstStep) {
                async.forEachSeries(deals, function (item, finishItemProcessing) {
                    var site = $(item).children('span.site-name').text()
                        , title = $(item).find('h3').attr('title').trim()
                        , link = $(item).find('h3').children('a').attr('href');

                    var deal = {
                        title: {
                            full: title
                        },
                        site: site
                    };

                    console.log('waiting to pakkumised.ee source request', link)

                    request({
                        uri: link
                    }, function (err, response, body) {
                        console.log('counting pakkumised.ee link: ', counter);

                        if (!(err || response.statusCode !== 200) && body) {
                            parsePage(body, function($) {
                                var originalUrl = $('iframe.offerpage_content').attr('src');

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

                                                var parsedUrl = url.parse(originalUrl);
                                                deal.url = {
                                                    href: parsedUrl.href
                                                    , host: parsedUrl.host
                                                    , hostname: parsedUrl.hostname
                                                    , pathname: parsedUrl.pathname
                                                }

                                                var template = require(__dirname + '/model/' + site + ".js");

                                                console.log('template', template)
                                                _.extend(deal, template)
                                                _.extend(deal, {
                                                    parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()
                                                })

                                                db.offers.save(deal)

                                                console.log('Deal saved:', deal.title.full)

                                                if (deal.pictures) {
                                                    console.log('Fetching images:', deal.pictures.length)

                                                    var DOWNLOAD_DIR = __dirname + '/public/images/' + deal._id + '/';

                                                    var imageProcessor = function (picture, finishImageProcessing) {
                                                        console.log('processing image: ', picture)
                                                        if (picture.url !== undefined) {
                                                            var imageHostName = deal.url.hostname
                                                            var imagePathName = picture.url.replace(deal.url.hostname, '');

                                                            var imageFullPath = imageHostName + imagePathName;
                                                            console.log('image: ', imageFullPath)

                                                            var filename = url.parse(imageFullPath).pathname.split("/").pop()
                                                            console.log('filename: ', filename)

                                                            var options = {
                                                                host: imageHostName,
                                                                port: 80,
                                                                path: imagePathName
                                                            };

                                                            var file = fs.createWriteStream(DOWNLOAD_DIR + filename, {'flags':'a'});

                                                            http.get(options, function (res) {
                                                                console.log("File size " + filename + ": " + res.headers['content-length'] + " bytes.");

                                                                res
                                                                    .on('data',function (data) {
                                                                        file.write(data);
                                                                    })
                                                                    .on('end', function () {
                                                                        file.end();
                                                                        console.log(filename + ' downloaded to ' + DOWNLOAD_DIR);

                                                                        new thumbbot(DOWNLOAD_DIR + filename, DOWNLOAD_DIR + filename + ".thumb", function() {
                                                                            this.attributes
                                                                        })

                                                                        finishImageProcessing()
                                                                    });
                                                            });
                                                        }
                                                        else {
                                                            console.log('error reading image');
                                                            finishImageProcessing()
                                                        }
                                                    };

                                                    exec('mkdir -p ' + DOWNLOAD_DIR, function (err, stdout, stderr) {
                                                        if (err) {
                                                          console.log('Error creating directory:', err)
                                                        }
                                                        else {
                                                            console.log('directory created: ', DOWNLOAD_DIR);
                                                            async.forEachSeries(deal.pictures, imageProcessor, function (err) {
                                                                result.items.push(deal);
                                                                console.log('fetching images finished successfully', link)
                                                                finishItemProcessing()
                                                            })
                                                        }
                                                    });
                                                }
                                                else {
                                                    finishItemProcessing()
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

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
