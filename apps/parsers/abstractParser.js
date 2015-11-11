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
        LOG.profile("tidy");

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
        }, function (err, body) {
          if (err) {
            LOG.error({
              'message': 'Error cleaning up HTML',
              'error': err.message
            });
          }

          LOG.profile("tidy");

          data = null;
          tidy = null;

          return done(err, body);
        });
    },
    function (body, done) {
        LOG.profile("cheerio");

        var cheerio = require("cheerio");

        var dom = cheerio.load(body, {
          normalizeWhitespace: true,
          lowerCaseTags: true,
          lowerCaseAttributeNames: true,
          recognizeCDATA: true,
          recognizeSelfClosing: true,
          decodeEntities: true
        });

        body = null;
        cheerio = null;

        LOG.profile("cheerio");

        return done(null, dom);
    }],
    function (err, dom) {
      if (err) {
        LOG.error({
          'message': 'Error parsing response body',
          'error': err.message
        });
      }

      return callback(err, dom);
    });
};

AbstractParser.prototype.getPagingParameters = function (language, dom) {
  var that = this;

  LOG.debug('Checking if paging exists.', language, dom);

  if (that.config.paging) {
    var paging = that.config.paging.call(that, language, dom);

    if (_.size(paging) > 0) {
      LOG.debug('Paging found. Total pages: ', _.size(paging.pages));
      LOG.debug('Paging properties:', paging);

      return paging;
    }

    LOG.debug('Paging not found.');
    return false;
  }

  LOG.debug('Paging is not configured.');
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

AbstractParser.prototype.compileImageUrl = function compileImageUrl(language, link) {
  return link;
};

AbstractParser.prototype.compilePageUrl = function compilePageUrl(language, link) {
  return link;
};

AbstractParser.prototype.compileOfferUrl = function compileOfferUrl(language, link) {
  return link;
};

AbstractParser.prototype.getSite = function () {
  return this.config.site || '';
};

AbstractParser.prototype.parse = function parse(dom, language, callback) {
  var offer = (function (that, dom, language) {
    LOG.profile("AbstractParser.parseOffer");

    var templates = _.extend({}, that.config.templates);

    function _parseTemplates(dom, templates, language) {
      LOG.profile("AbstractParser._parseTemplates");

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

      LOG.profile("AbstractParser._parseTemplates");

      return result;
    }

    var result = _parseTemplates(dom, templates, language);

    dom = null;

    _.extend(result, {
      'language': that.languages[language]
    });

    LOG.profile("AbstractParser.parseOffer");

    return result;
  })(this, dom, language);

  callback(null, offer);
};

module.exports = AbstractParser;
