
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
                            request({
                                uri: deal.origin,
                                timeout: 30000
                            }, function (err, response, body) {
                                if (!(err || response.statusCode !== 200) && body) {
                                    parsePage(body, function($) {

                                        console.log($('body'))

                                        if (!result.items[$site]) {
                                            result.items[$site] = [];
                                        }

                                        result.items[$site].push(deal);

                                    });
                                }
                                else {
                                    console.log('Error: ', err);
                                }

                                if (counter === 0) {
                                    res.json(result);
                                }
                            });
                        }
                    });
                }
                else {
                    console.log('Error: ', err, deal.href);
                }
            });
        });
    });

});

function sleep(milliSeconds) {
    var startTime = new Date().getTime();
    while (new Date().getTime() < startTime + milliSeconds);
}

var parseContent = function (site, body) {
    var content = "";

    if (site === 'www.zizu.ee') {
        content = body.find('#content');

        return {
            'description':content.length
        };
    }

    if (site === 'www.cherry.ee') {
        content = body.find('#content');

        return {
            'description':content.find('div.split-content').html()
        };
    }
};

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
