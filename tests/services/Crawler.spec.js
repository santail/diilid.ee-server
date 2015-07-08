var request = require('request'),
  sinon = require('sinon'),
  should = require('should'),
  Crawler = require('../../apps/services/Crawler');

var crawler = new Crawler({
  'retryTimeout': 0
});

describe('Crawler service', function () {

  it('should retry 3 times and exit with error', function (done) {
    sinon
      .stub(request, 'get')
      .yields(null, {
        'statusCode': 400
      }, 'some response');

    crawler.request('www.ee', function (err, data) {
      should.exist(err);

      should(err).be.a.Error;

      should(err.message).be.exactly('Request failed. No retries left.');

      request.get.restore();
      done();
    });
  });

});