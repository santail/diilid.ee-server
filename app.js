
/**
 * Module dependencies.
 */
var express = require('express')
    , routes = require('./routes')
    , request = require('request')
    , jsdom = require('jsdom')
    , async = require('async')
    , _ = require('underscore')._
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
app.get('/deals', function (req, res) {
    req.connection.setTimeout(600000);

    var counter = 0, processing = 0, $deals = [], result = {}, runningTime = new Date();

    console.log('checking fresh parsed links exist')
    db.offers.find({
      parsed: runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()
    }, function(err, offers) {

        if (err || !offers || offers.length == 0) {
            console.log('fresh links missed')
            console.log('harvesting...')

            fetchPage('http://pakkumised.ee', function ($) {
                $deals = $('body').find('.offers-list li');

                result.total = counter = $deals.length;
                result.items = [];

                console.log('Deals total: ', $deals.length);

                async.series([
                    function (callback) {
                        async.forEachSeries($deals, function (item, callback) {
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
                                        deal.origin = $('iframe.offerpage_content').attr('src');

                                        console.log('pakkumised.ee deal origin link', deal.origin)

                                        if (deal.origin) {
                                            console.log('waiting request to original deal', deal.origin)

                                            request({
                                                uri: deal.origin,
                                                timeout: 30000
                                            }, function (err, response, body) {
                                                counter--;

                                                console.log('counting: ', counter);

                                                if (!(err || response.statusCode !== 200) && body) {
                                                    parsePage(body, function($) {
                                                        if (site === 'www.super24.ee') {
                                                            var pictures = [];
                                                            pictures.push({
                                                                url: $('#container .c-main .inner.clearfix2 .main-img-wrp img').attr('src'),
                                                                main: true
                                                            })

                                                            $('#container .c-info .inner .form-item .photos a').each(function (i, link) {
                                                                pictures.push({
                                                                    url: $(link).attr('link')
                                                                })
                                                            })
                                                            deal.pictures = pictures
                                                            deal.price = {
                                                                discount: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .discount-price').text(),
                                                                regular: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .regular-price').text(),
                                                                benefit: $('#container .c-main .inner.clearfix2 .main-details-wrp .price .econ').text()
                                                            }
                                                            deal.exposed = ''
                                                            deal.end = ''

                                                            deal.title = {
                                                                full: $('#container .c-main .inner.clearfix2 h1').text(),
                                                                short: $('#container .c-main .inner.clearfix2 h2').text()
                                                            }

                                                            deal.seller = {
                                                                info: $('#seller-info .content').html()
                                                            }

                                                            $('#container .c-info .inner .form-item .photos').remove()
                                                            $('#seller-info').remove()
                                                            deal.description = {
                                                                full: $('#container .c-info .inner .form-item').html(),
                                                                map: $('#container .c-info .inner .form-item .Gmap').attr('src')
                                                            }
                                                        }
                                                        if (site === 'www.seiklused.ee') {
                                                            deal.title = {
                                                                full: $('#strip > b').text(),
                                                                short: $('#separator403 > b').text()
                                                            }
                                                        }
                                                        if (site === 'www.headiil.ee') {
                                                            deal.title = {
                                                                full: $('#body_left > h1').text(),
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.chilli.ee') {
                                                            deal.title = {
                                                                full: $('#buy_box > h1 > a').text(),
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.ediilid.ee') {
                                                            $('.leftSide .box1 .mainOfferTitleArea > p > span').remove()

                                                            deal.title = {
                                                                full: $('.leftSide .box1 .mainOfferTitleArea > p').text(),
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.ostulaine.ee') {
                                                            var pictures = [];
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
                                                            deal.pictures = pictures

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
                                                        if (site === 'www.niihea.ee') {
                                                            deal.title = {
                                                                full: '',
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.zizu.ee') {

                                                            var pictures = [];
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
                                                            deal.pictures = pictures

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
                                                        if (site === 'www.cherry.ee') {
                                                            deal.title = {
                                                                full: '',
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.hotelliveeb.ee') {
                                                            deal.title = {
                                                                full: '',
                                                                short: ''
                                                            }
                                                        }
                                                        if (site === 'www.minuvalik.ee') {
                                                            var pictures = [];
                                                            pictures.push({
                                                                url: $('#form_block table').eq(1).find('td').eq(0).children('a').children('img').attr('src'),
                                                                main: true
                                                            })

                                                            $('#form_block > div').eq(2).children('div').eq(0).children('img').each(function (i, image) {
                                                                pictures.push({
                                                                    url: $(image).attr('src')
                                                                })
                                                                $(image).remove()
                                                            })
                                                            deal.pictures = pictures

                                                            deal.price = {
                                                                discount: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(0).text(),
                                                                regular: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(6).text(),
                                                                percent: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(7).text(),
                                                                benefit: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(8).text()
                                                            }
                                                            deal.exposed = ''
                                                            deal.end = ''

                                                            deal.title = {
                                                                full: $('#form_block > div').eq(0).text(),
                                                                short: ''
                                                            }

                                                            deal.seller = {
                                                                info: $('#form_block > div').eq(1).html()
                                                            }

                                                            deal.description = {
                                                                full: $('#form_block > div').eq(2).children('div').eq(0).html(),
                                                                map: $('#show_map > a > img').attr('src')
                                                            }
                                                        }

                                                        deal.parsed = runningTime.getDate() + "/" + runningTime.getMonth() + "/" + runningTime.getYear()

                                                        db.offers.save(deal)

                                                        console.log(deal.title.full)

                                                        result.items.push(deal);

                                                        console.log('parsing pakkumised.ee link finished successfully', link)
                                                        callback()
                                                    });
                                                }
                                                else {
                                                    console.log('parsing pakkumised.ee link failed', link)
                                                    callback()
                                                }
                                            });
                                        }
                                        else {
                                            counter--
                                            console.log('item has no origin url: ', link)
                                            callback()
                                        }
                                    });
                                }
                                else {
                                    counter--
                                    console.log('parsing pakkumised.ee link finished with error', link, err)
                                    callback()
                                }
                            });

                        }, function(err) {
                            if (err) {
                                console.log('error reading pakkumised.ee original links', err)
                            }
                            if (counter === 0) {
                                console.log('parsing pakkumised.ee finished successfully')
                                callback(null, 'one');
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
