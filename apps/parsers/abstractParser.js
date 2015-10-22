'use strict';

var _ = require("underscore")._,
  async = require('async'),
  LOG = require("../services/Logger"),
  utils = require("../services/Utils");

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

AbstractParser.prototype.parseResponseBody = function (data, callback) {
  LOG.debug('Create DOM from body', data);

  async.waterfall([
    function (done) {
        console.time("tidy");

        // TODO Warning: tidy uses 32 bit binary instead of 64, https://github.com/vavere/htmltidy/issues/11
        // TODO Needs manual update on production for libs

        var tidy = require('htmltidy').tidy;

        tidy(data, {
          doctype: 'html5',
          indent: false,
          bare: true,
          breakBeforeBr: false,
          hideComments: false,
          fixUri: false,
          wrap: 0
        }, function (err, data) {
          if (err) {
            LOG.error({
              'message': 'Error cleaning up HTML',
              'error': err.message
            });
          }

          console.timeEnd("tidy");

          return done(err, data);
        });
    },
    function (data, done) {
        console.time("cheerio");

        var cheerio = require("cheerio");

        var dom = cheerio.load(data, {
          normalizeWhitespace: true,
          lowerCaseTags: true,
          lowerCaseAttributeNames: true,
          recognizeCDATA: true,
          recognizeSelfClosing: true,
          decodeEntities: true
        });

        console.timeEnd("cheerio");

        done(null, dom);
    }],
    function (err, result) {
      if (err) {
        LOG.error({
          'message': 'Error parsing response body',
          'error': err.message
        });
      }

      return callback(err, result);
    });
};

AbstractParser.prototype.getPagingParameters = function (language, dom) {
  var that = this;

  LOG.info('Checking if paging exists.', language, dom);

  if (that.config.paging) {
    var paging = that.config.paging.call(that, language, dom);

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

AbstractParser.prototype.getOfferLinks = function (dom, language) {
  var that = this;

  var links = that.config.list.call(that, dom, language);

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

AbstractParser.prototype.parse = function (dom, language, callback) {
  console.time("AbstractParser.parseOffer");

  var that = this,
    templates = _.extend({}, that.config.templates);

  var _parseTemplates = function (dom, templates, language) {
    console.time("AbstractParser._parseTemplates");

    var result = {};

    for (var key in templates) {

      if (templates.hasOwnProperty(key)) {
        var template = templates[key];

        if (typeof template === 'object') {
          result[key] = _parseTemplates(dom, template, language);
        }
        else if (typeof template === 'function') {
          var value = template.call(null, dom, language);
          result[key] = typeof value === "string" ? utils.unleakString(value).trim().replace(/\t/g, ' ').replace(/\s\s+/g, ' ') : value;
        }
      }
    }

    console.timeEnd("AbstractParser._parseTemplates");

    return result;
  };

  var offer = _parseTemplates(dom, templates, language);

  console.log(offer);

  _.extend(offer, {
    'language': that.languages[language]
  });

  console.timeEnd("AbstractParser.parseOffer");

  callback(null, offer);

};

module.exports = AbstractParser;
