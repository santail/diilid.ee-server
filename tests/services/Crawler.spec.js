var request = require('request'),
  sinon = require('sinon'),
  should = require('should'),
  Crawler = require('../../apps/services/Crawler');

describe('Crawler service', function () {

  beforeEach(function() {
		this.request = sinon.stub(request, 'get');
		// this.clock = sinon.useFakeTimers();
	});

	afterEach(function() {
		request.get.restore();
		// this.clock.restore();
	});

  this.timeout(20 * 1000);

  it.skip('should initiate with custom options', function (done) {
    var crawler = new Crawler({
      'retries': 5
    });

    crawler.options.should.not.be.empty;
    crawler.options.retries.should.eql(5);

    done();
  });

  it('should make 3 successfull requests to different url with different proxies', function (done) {
    var crawler = new Crawler({
      'retryTimeout': 0,
      'proxies': [
        'http://46.101.248.216:8887/',
        'http://46.101.248.216:8888/',
        'http://46.101.248.216:8889/'
        ]
    });

    var stub = this.request;
    stub.onCall(0).yields(null, {statusCode: 200}, 'foo') ;
    stub.onCall(1).yields(null, {statusCode: 200}, 'foo') ;
    stub.onCall(2).yields(null, {statusCode: 200}, 'foo') ;

    crawler.request('http://request1', function (err, data) {
      sinon.assert.calledOnce(stub);
    });

    crawler.request('http://request2', function (err, data) {
      sinon.assert.calledTwice(stub);
    });

    crawler.request('http://request3', function (err, data) {
      sinon.assert.calledThrice(stub);
    });

    sinon.assert.calledThrice(stub);

    stub.getCall(0).args[1].proxy.should.be.eql('http://46.101.248.216:8887/');
    stub.getCall(1).args[1].proxy.should.be.eql('http://46.101.248.216:8888/');
    stub.getCall(2).args[1].proxy.should.be.eql('http://46.101.248.216:8889/');

    setTimeout(done, 1 * 1000);
  });

  it('should retry 3 times with different proxies and exit with error', function (done) {
    var crawler = new Crawler({
      'retryTimeout': 0,
      'proxies': [
        'http://46.101.248.216:8887/',
        'http://46.101.248.216:8888/',
        'http://46.101.248.216:8889/'
        ]
    });

    var stub = this.request;
    stub.onFirstCall().yields(null, {statusCode: 400}, 'foo') ;
    stub.onSecondCall().yields(null, {statusCode: 400}, 'foo') ;
    stub.onThirdCall().yields(null, {statusCode: 400}, 'foo') ;

    crawler.request('http://request1', function (err, data) {
      sinon.assert.calledThrice(stub);

      err.should.be.eql(new Error("Request failed. No retries left."));

      stub.getCall(0).args[1].proxy.should.be.eql('http://46.101.248.216:8887/');
      stub.getCall(1).args[1].proxy.should.be.eql('http://46.101.248.216:8888/');
      stub.getCall(2).args[1].proxy.should.be.eql('http://46.101.248.216:8889/');

      done();
    });
  });

  it('should retry 2 times for first request and 3 times for another', function (done) {
    var stub = this.request;
    stub.onCall(0).yields(null, {statusCode: 400}, 'foo') ;
    stub.onCall(1).yields(null, {statusCode: 200}, 'foo') ;
    
    stub.onCall(2).yields(null, {statusCode: 400}, 'foo') ;
    stub.onCall(3).yields(null, {statusCode: 400}, 'foo') ;
    stub.onCall(4).yields(null, {statusCode: 200}, 'foo') ;

    var crawler1 = new Crawler({
      'retryTimeout': 0,
      'proxies': [
        'http://46.101.248.216:8887/',
        'http://46.101.248.216:8888/',
        'http://46.101.248.216:8889/'
        ]
    });
    
    crawler1.request('http://request1', function (err, data) {
    });

    var crawler2 = new Crawler({
      'retryTimeout':0,
      'proxies': [
        'http://46.101.248.216:8887/',
        'http://46.101.248.216:8888/',
        'http://46.101.248.216:8889/'
        ]
    });

    crawler2.request('http://request2', function (err, data) {
    });
    
    setTimeout(function () {
      stub.callCount.should.be.eql(5);
    
      stub.getCall(0).args[1].proxy.should.be.eql('http://46.101.248.216:8887/');
      stub.getCall(1).args[1].proxy.should.be.eql('http://46.101.248.216:8888/');
      
      stub.getCall(2).args[1].proxy.should.be.eql('http://46.101.248.216:8887/');
      stub.getCall(3).args[1].proxy.should.be.eql('http://46.101.248.216:8888/');
      stub.getCall(4).args[1].proxy.should.be.eql('http://46.101.248.216:8889/');
    
      done();
    }, 5 * 1000);
  });

});