function ParserFactory() {
  this.parsers = {};
}

ParserFactory.prototype.getParser = function (site) {
  if (!this.parsers[site]) {
    var Parser = require(__dirname + '/../parsers/' + site + ".js"),
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