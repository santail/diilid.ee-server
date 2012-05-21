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

                                                var pictures = []
                                                    , price = {
                                                        discount: false
                                                        , regular: false
                                                        , benefit: false
                                                        , percent: false
                                                    }
                                                    , description = {
                                                        full: false
                                                        , short: false
                                                        , map: false
                                                    }
                                                    , title = {
                                                        full: false
                                                        , short: false
                                                    }

                                                if (site === 'www.headiil.ee') {
                                                    deal.title = {
                                                        full: $('#body_left > h1').text(),
                                                        short: ''
                                                    }
                                                }
                                                if (site === 'www.hotelliveeb.ee') {
                                                    deal.title = {
                                                        full: '',
                                                        short: ''
                                                    }
                                                }
                                                if (site === 'www.cherry.ee') {
                                                    deal.title = {
                                                        full: '',
                                                        short: ''
                                                    }
                                                }
                                                if (site === 'www.chilli.ee') {
                                                    $('#slider img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                            , main: true
                                                        })
                                                    })

                                                    $('#description img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                        })
                                                        $(image).remove()
                                                    })

                                                    _.extend(price, {
                                                        discount: $('#buy_box div.osta h2').text()
                                                        , regular: $('#buy_box p.little_box span.little_box_nr').eq(0).text()
                                                        , percent: $('#buy_box p.little_box span.little_box_nr').eq(1).text()
                                                    })

                                                    _.extend(title, {
                                                        full: $('#buy_box h1').text()
                                                    })

                                                    deal.seller = {
                                                        info: $('#asukoht').html()
                                                    }

                                                    _.extend(description, {
                                                        full: $('#description div.desc_left').html()
                                                        , short: $('#description div.desc_right').html()
                                                        , map: $('#show_map > a > img').attr('src')
                                                    })
                                                }
                                                if (site === 'www.ediilid.ee') {
                                                    $('.leftSide .box1 .mainOfferTitleArea > p > span').remove()

                                                    deal.title = {
                                                        full: $('.leftSide .box1 .mainOfferTitleArea > p').text()
                                                        , short: $('.leftSide .box1 .mainOfferTitleArea > p').text()
                                                    }
                                                }
                                                if (site === 'www.iluveeb.ee') {
                                                    deal.title = {
                                                        full: $('#buy_box > h1 > a').text(),
                                                        short: ''
                                                    }
                                                }
                                                if (site === 'www.minuvalik.ee') {
                                                    pictures.push({
                                                        url: $('#form_block table').eq(1).find('td').eq(0).children('img').attr('src')
                                                        , main: true
                                                    })

                                                    $('#form_block > div').eq(2).children('div').eq(0).children('img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                        })
                                                        $(image).remove()
                                                    })

                                                    _.extend(price, {
                                                        discount: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(0).text(),
                                                        regular: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(6).text(),
                                                        percent: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(7).text(),
                                                        benefit: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(8).text()
                                                    })

                                                    deal.exposed = ''
                                                    deal.end = ''

                                                    _.extend(title, {
                                                        full: $('#form_block > div').eq(0).text(),
                                                        short: $('#form_block > div').eq(0).text()
                                                    })

                                                    deal.seller = {
                                                        info: $('#form_block > div').eq(1).html()
                                                    }

                                                    _.extend(description, {
                                                        full: $('#form_block > div').eq(2).children('div').eq(0).html()
                                                        , map: $('#show_map > a > img').attr('src')
                                                    })
                                                }
                                                if (site === 'www.niihea.ee') {
                                                    $('div.images img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                        })
                                                    })

                                                    $('div.gallery a').each(function (i, link) {
                                                        pictures.push({
                                                            url: $(link).attr('href')
                                                        })
                                                        $(link).remove()
                                                    })

                                                    _.extend(price, {
                                                        discount: $('div.content.bigoffer div.pricetag > div.amount').text()
                                                        , regular: $('div.content.bigoffer div.pricetag > div.savings').text()
                                                    })

                                                    deal.exposed = ''
                                                    deal.end = ''

                                                    _.extend(title, {
                                                        full: $('div.content.bigoffer div.title > div.inner').text()
                                                        , short: $('div.content.bigoffer div.title > div.inner').text()
                                                    })

                                                    deal.seller = {
                                                        info: $('div.content.bigoffer div.col2').html()
                                                    }

                                                    _.extend(description, {
                                                        full: $('div.content.bigoffer div.col3 div').eq(0).html()
                                                        , map: $('#show_map > a > img').attr('src')
                                                    })
                                                }
                                                if (site === 'www.osta.ee') {}
                                                if (site === 'www.ostulaine.ee') {
                                                    pictures.push({
                                                        url: $('#content').children('.b-content-white-i').eq(0).children('p').children('img').attr('src'),
                                                        main: true
                                                    })

                                                    $('#content').children('.b-content-white-i').eq(1).find('p.rtecenter img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                        })
                                                        $(image).remove()
                                                    })

                                                    deal.price = {
                                                        discount: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('h2').eq(0).text(),
                                                        regular: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('p').eq(0).text(),
                                                        percent: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('h2').eq(1).text(),
                                                        benefit: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('p').eq(1).text()
                                                    }
                                                    deal.exposed = ''
                                                    deal.end = ''

                                                    deal.title = {
                                                        full: $('#body_left').children('div.main_deal_title').text(),
                                                        short: ''
                                                    }

                                                    deal.seller = {
                                                        info: $('#content').children('.b-content-white-i').eq(1).children('table').eq(1).find('td').eq(1).html()
                                                    }

                                                    deal.description = {
                                                        full: $('#content').children('.b-content-white-i').eq(1).children('table').eq(0).find('td').eq(0).html(),
                                                        short: $('#content').children('.b-content-white-i').eq(1).children('table').eq(0).find('td').eq(1).html(),
                                                        map: $('#content').children('.b-content-white-i').eq(1).children('table').eq(1).find('td').eq(0).find('img').attr('src')
                                                    }
                                                }
                                                if (site === 'www.seiklused.ee') {
                                                    deal.title = {
                                                        full: $('#strip > b').text(),
                                                        short: $('#separator403 > b').text()
                                                    }
                                                }
                                                if (site === 'www.super24.ee') {
                                                    pictures.push({
                                                        url: $('#container .c-main .inner.clearfix2 .main-img-wrp img').attr('src'),
                                                        main: true
                                                    })

                                                    $('#container .c-info .inner .form-item .photos a').each(function (i, link) {
                                                        pictures.push({
                                                            url: $(link).attr('link')
                                                        })
                                                    })

                                                    _.extend(price, {
                                                        discount: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .discount-price').text(),
                                                        regular: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .regular-price').text(),
                                                        benefit: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .econ').text()
                                                    })

                                                    _.extend(title, {
                                                        full: $('#container .c-main .inner.clearfix2 h1').text(),
                                                        short: $('#container .c-main .inner.clearfix2 h2').text()
                                                    })

                                                    deal.seller = {
                                                        info: $('#seller-info .content').html()
                                                    }

                                                    $('#container .c-info .inner .form-item .photos').remove()
                                                    $('#seller-info').remove()

                                                    _.extend(description, {
                                                        full: $('#container .c-info .inner .form-item').html()
                                                        , map: $('#container .c-info .inner .form-item .Gmap').attr('src')
                                                    })
                                                }
                                                if (site === 'www.zizu.ee') {
                                                    pictures.push({
                                                        url: $('#content').children('.b-content-white-i').eq(0).children('p').children('img').attr('src'),
                                                        main: true
                                                    })

                                                    $('#content').children('.b-content-white-i').eq(1).find('p.rtecenter img').each(function (i, image) {
                                                        pictures.push({
                                                            url: $(image).attr('src')
                                                        })
                                                        $(image).remove()
                                                    })

                                                    deal.price = {
                                                        discount: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('h2').eq(0).text(),
                                                        regular: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('p').eq(0).text(),
                                                        percent: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('h2').eq(1).text(),
                                                        benefit: $('#content').children('.b-content-white-i').eq(0).find('table td').eq(1).children('p').eq(1).text()
                                                    }
                                                    deal.exposed = ''
                                                    deal.end = ''

                                                    deal.title = {
                                                        full: $('#content').children('.b-content-white-i').eq(0).children('h1').text(),
                                                        short: ''
                                                    }

                                                    deal.seller = {
                                                        info: $('#content').children('.b-content-white-i').eq(1).children('table').eq(1).find('td').eq(1).html()
                                                    }

                                                    deal.description = {
                                                        full: $('#content').children('.b-content-white-i').eq(1).children('table').eq(0).find('td').eq(0).html(),
                                                        short: $('#content').children('.b-content-white-i').eq(1).children('table').eq(0).find('td').eq(1).html(),
                                                        map: $('#content').children('.b-content-white-i').eq(1).children('table').eq(1).find('td').eq(0).find('img').attr('src')
                                                    }
                                                }

                                                _.extend(deal, {
                                                    pictures: pictures
                                                    , parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()
                                                    , price: price
                                                    , description: description
                                                    , title: title
                                                })

                                                db.offers.save(deal)

                                                console.log('Deal saved:', deal.title.full)
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

                                                                    ///... store images, make thumbnails... do more stuff
                                                                    finishImageProcessing()
                                                                });
                                                        });
                                                    }
                                                    else {
                                                        console.log('error reading image');
                                                        finishImageProcessing()
                                                    }
                                                };

                                                if (deal.pictures.length > 0) {
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
