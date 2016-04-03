'use strict';

var util = require('util'),
  AbstractExpertParser = require("./AbstractExpertParser"),
  _ = require("underscore")._;

function ExpertDiscountParser() {
  AbstractExpertParser.call(this);

  var that = this;

  var config = {
    'site': 'www.expert.discount.ee',
    'index': {
      'est': 'http://www.expert.ee/shop/special-list/product-list'
    },
    'paging': {
      finit: true,
      nextPageUrl: function nextPageUrl(language, offset) {
        return that.compilePageUrl(language, '?type=discount&priceRange%5Bmin%5D=49&priceRange%5Bmax%5D=69999&limit=12&offset={offset}&sort=date_desc'.replace('{offset}', offset));
      }
    }
  };

  this.config = _.extend(this.config, config);
}

util.inherits(ExpertDiscountParser, AbstractExpertParser);

module.exports = ExpertDiscountParser;
