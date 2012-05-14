
/**
 * Module dependencies.
 */
var express = require('express'),
    routes = require('./routes'),
    request = require('request'),
    jsdom = require('jsdom'),
    async = require('async'),
    _ = require('underscore')._;

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

    var self = this, counter = 0, processed = 0, processing = 0, $deals = [], result = {}, items = [];

    fetchPage('http://pakkumised.ee', function ($) {
        $deals = $('body').find('.offers-list li');

        result.total = counter = $deals.length;
        result.items = {};

        console.log('Deals total: ', $deals.length);

        async.series([
            function (callback) {

                async.forEachSeries($deals, function (item, callback) {
                    var $title = $(item).find('h3'),
                        $a = $title.children('a'),
                        $img = $(item).children('a').children('img'),
                        $site = $(item).children('span.site-name').text();

                    var deal = {
                        href:$a.attr('href'),
                        title:$title.attr('title').trim(),
                        thumbnail:$img.attr('src'),
                        site: $site
                    };

                    console.log('waiting to pakkumised.ee source request', deal.href)

                    request({
                        uri: deal.href
                    }, function (err, response, body) {
                        counter--;

                        console.log('counting pakkumised.ee link: ', counter);

                        if (!(err || response.statusCode !== 200) && body) {
                            parsePage(body, function($) {
                                deal.origin = $('iframe.offerpage_content').attr('src');

                                console.log('pakkumised.ee deal origin link', deal.origin)

                                if (deal.origin) {
                                    if (!result.items[$site]) {
                                        result.items[$site] = [];
                                    }

                                    result.items[$site].push(deal);
                                }

                                console.log('parsing pakkumised.ee link finished successfully', deal.href)
                                callback()
                            });
                        }
                        else {
                            console.log('parsing pakkumised.ee link finished with error', deal.href, err)
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
            },
            function (callback) {
                var sites = _.keys(result.items),
                    siteCounter = sites.length;

                async.forEachSeries(sites, function($site, callback) {
                    var dealsCounter = result.items[$site].length

                    console.log('processing', $site)

                    async.forEachSeries(result.items[$site], function(deal, callback) {

                        console.log('waiting request to original deal', deal.origin)

                        request({
                            uri: deal.origin,
                            timeout: 30000
                        }, function (err, response, body) {
                            dealsCounter--;

                            console.log('counting: ', dealsCounter);

                            if (!(err || response.statusCode !== 200) && body) {
                                parsePage(body, function($) {
                                    if ($site === 'www.super24.ee') {
                                        var pictures = [];
                                        pictures.push({
                                            url: $('#container .c-main .inner.clearfix2 .main-img-wrp img').attr('src'),
                                            main: true
                                        })

                                        $('#container .c-info .inner .form-item .photos a').each(function (i, link) {
                                            pictures.push({
                                                url: $(link).attr('href')
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
                                    if ($site === 'www.ostulaine.ee') {
                                        deal.title = {
                                            full: $('#body_left .main_deal_title').text(),
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.seiklused.ee') {
                                        deal.title = {
                                            full: $('#strip > b').text(),
                                            short: $('#separator403 > b').text()
                                        }
                                    }
                                    if ($site === 'www.headiil.ee') {
                                        deal.title = {
                                            full: $('#body_left > h1').text(),
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.chilli.ee') {
                                        deal.title = {
                                            full: $('#buy_box > h1 > a').text(),
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.ediilid.ee') {
                                        $('.leftSide .box1 .mainOfferTitleArea > p > span').remove()

                                        deal.title = {
                                            full: $('.leftSide .box1 .mainOfferTitleArea > p').text(),
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.ostulaine.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.niihea.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.zizu.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.cherry.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.hotelliveeb.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }
                                    if ($site === 'www.minuvalik.ee') {
                                        deal.title = {
                                            full: '',
                                            short: ''
                                        }
                                    }

                                    console.log(deal.title)
                                });
                            }

                            callback();
                        });


                    }, function(err){
                        if (err) {
                            console.log('error reading deal', err)
                        }

                        if (dealsCounter === 0) {
                            siteCounter--
                            callback()
                        }

                    });

                }, function(err){
                    if (err) {
                        console.log('error reading deals', err)
                    }

                    if (siteCounter === 0) {
                        callback(null, 'two');
                    }
                });

                console.log('perform second iteration')
            }
        ],
        function (err) {
            console.log('processing done')
            console.log('parsed links:', result)

            res.json({ user: 'tj' });
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

//        window.close()
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
