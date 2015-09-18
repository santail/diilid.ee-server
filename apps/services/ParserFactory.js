function ParserFactory() {
  this.parsers = {};
}

ParserFactory.prototype.getParser = function (site) {
  if (!this.parsers[site]) {
    var path;

    if (site === 'pakkumised.ee') {
      path = __dirname + '/../parsers/pakkumised.ee.js';
    }
    else {
      path = __dirname + '/../parsers/' + site + ".js";
    }

    var Parser = require(path),
      parser = new Parser();

    this.parsers[site] = parser;

    console.log('Created parser', site);
  }

  return this.parsers[site];
};

ParserFactory.prototype.getPakkumisedParser = function () {
  return this.getParser('pakkumised.ee');
};

module.exports = ParserFactory;