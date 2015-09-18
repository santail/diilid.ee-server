'use strict';

var _ = require("underscore")._,
  async = require('async'),
  cheerio = require("cheerio"),
  tidy = require('htmltidy').tidy,
  LOG = require("../services/Logger"),
  memwatch = require('memwatch-next'),
  utils = require("../services/Utils"),
  util = require("util");


var heapdump = require('heapdump');

function AbstractParser() {
  this.config = {};
  this.isInPakkumised = false;

  this.languages = {
    'rus': 'ru',
    'est': 'fi',
    'eng': 'en'
  };
}

AbstractParser.prototype.isPakkumised = function () {
  return this.isInPakkumised;
};

AbstractParser.prototype.parseResponseBody = function (body) {
  LOG.debug('Create DOM from body', body);

  return cheerio.load(body, {
    normalizeWhitespace: true,
    xmlMode: true,
    decodeEntities: true
  });
};

AbstractParser.prototype.getPagingParameters = function (language, body) {
  var that = this;

  LOG.info('Checking if paging exists.');

  if (that.config.paging) {
    var paging = that.config.paging.call(that, language, body);

    if (_.size(paging) > 0) {
      LOG.info('Paging found. Total pages: ', _.size(paging.pages));
      LOG.debug('Paging properties:', paging);

      return paging;
    }

    LOG.info('Paging not found.');
    return false;
  }

  LOG.info('Paging is not configured.');
  return false;
};

AbstractParser.prototype.getValidParser = function (url) {
  return this;
};

AbstractParser.prototype.getOfferLinks = function (data, language) {
  var that = this;

  var links = that.config.list.call(that, data, language);

  return _.map(links, function (link) {
    return that.compileOfferUrl(language, link);
  });
};

AbstractParser.prototype.compileImageUrl = function (language, link) {
  return link;
};

AbstractParser.prototype.compilePageUrl = function (language, link) {
  return link;
};

AbstractParser.prototype.compileOfferUrl = function (language, link) {
  return link;
};

AbstractParser.prototype.getSite = function () {
  return this.config.site || '';
};

AbstractParser.prototype._parseTemplates = function (dom, templates, language) {
  console.time("_parseTemplates");

  var that = this,
    result = {};

  async.forEachOf(templates, function (template, key, callback) {
      if (typeof template === 'object') {
        result[key] = that._parseTemplates(dom, template, language);
      }
      else if (typeof template === 'function') {
        var value = template.call(that, dom, language);
        result[key] = typeof value === "string" ? value.trim().replace(/\t/g, ' ').replace(/\s\s+/g, ' ') : value;
      }

      callback();
    },
    function (err) {
      if (err) {
        LOG.error({
          'message': 'Error applying template',
          'error': err.message
        });
      }
    });

  console.timeEnd("_parseTemplates");

  return result;
};

AbstractParser.prototype.parseOffer = function (body, language, callback) {
  console.time("AbstractParser.parseOffer");

  var that = this,
    language = language || 'est',
    dom, offer;

  // var stats = memwatch.gc();
  // console.log(stats);

  // var hd = new memwatch.HeapDiff(); // код приложения ...

  // TODO Warning: tidy uses 32 bit binary instead of 64, https://github.com/vavere/htmltidy/issues/11
  // TODO Needs manual update on production for libs

  async.series([
    function (done) {
        console.time("tidy");

        tidy(body, {
          doctype: 'html5',
          indent: true,
          bare: true,
          breakBeforeBr: true,
          hideComments: true,
          fixUri: true,
          wrap: 0
        }, function (err, body) {
          if (err) {
            LOG.error({
              'message': 'Error cleaning up HTML',
              'error': err.message
            });
          }

          console.timeEnd("tidy");

          return done(err);
        });
    },
    function (done) {
        console.time("cheerio");

        dom = cheerio.load(body, {
          normalizeWhitespace: true,
          lowerCaseTags: true,
          lowerCaseAttributeNames: true,
          recognizeCDATA: true,
          recognizeSelfClosing: true,
          decodeEntities: true
        });

        console.timeEnd("cheerio");

        done();
    },
    function (done) {
        console.time("AbstractParser._parseTemplates");

        offer = that._parseTemplates(dom, that.config.templates, language);

        _.extend(offer, {
          'language': that.languages[language]
        });

        done();

        console.timeEnd("AbstractParser._parseTemplates");
    }
    ],
    function (err) {
      if (err) {
        LOG.error({
          'message': 'Error parsing HTML',
          'error': err.message
        });

        return callback(err);
      }

      body = null;
      dom = null;

      console.timeEnd("AbstractParser.parseOffer");

/*
      var diff = hd.end();
      console.log(util.inspect(diff, {
        showHidden: true,
        depth: null,
        colors: true
      }));

      var file = process.pid + '-' + Date.now() + '.heapsnapshot';
      heapdump.writeSnapshot(file, function (err) {
        if (err) console.error(err);
        else console.error('Wrote snapshot: ' + file);
      });
*/
      callback(null, offer);
    });
};

module.exports = AbstractParser;
