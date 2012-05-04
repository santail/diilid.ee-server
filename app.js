
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

                $deals.each(function (i, item) {
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

                    setTimeout(function(){
                        console.log('waiting to request', deal.href)

                        request({
                            uri: deal.href,
                            timeout: 30000
                        }, function (err, response, body) {
                            counter--;

                            console.log('counting: ', counter);

                            if (!(err || response.statusCode !== 200) && body) {
                                parsePage(body, function($) {
                                    deal.origin = $('iframe.offerpage_content').attr('src');

                                    if (deal.origin) {
                                        if (!result.items[$site]) {
                                            result.items[$site] = [];
                                        }

                                        result.items[$site].push(deal);

                                    }
                                });
                            }
                            else {
                                console.log('Error: ', err, deal.href);
                            }

                            if (counter === 0) {
                                callback(null, 'one');
                            }
                        });
                    }, 1000);


                });
                console.log('perform first iteration')
            },
            function (callback) {
                var siteCounter = _.keys(result.items).length;

                async.forEach(_.keys(result.items), function($site) {
                    var dealsCounter = result.items[$site].length

                    console.log($site)

                    async.forEach(result.items[$site], function(deal) {

                        setTimeout(function(){
                            console.log('waiting to request', deal.origin)

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
                                            };

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
                                    });
                                }
                                else {
                                    console.log('Error: ', err, deal.origin);
                                }

                                if (dealsCounter === 0) {
                                    siteCounter--
                                }
                                if (dealsCounter === 0 && siteCounter === 0) {
                                    callback(null, 'two');
                                }
                            });

                        }, 1000);


                    }, function(err1){
                        // if any of the saves produced an error, err would equal that error
                    });

                }, function(err){
                    // if any of the saves produced an error, err would equal that error
                });

                console.log('perform second iteration')
            },
            function (callback) {
                res.json(result)
                callback(null, 'free');

                console.log('perform third iteration')
            }
        ],
// optional callback
            function (err, results) {
                // results is now equal to ['one', 'two']
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
