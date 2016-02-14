var request = require('request'),
  sinon = require('sinon'),
  should = require('should'),
  Harvester = require('../apps/harvester.js'),
  LOG = require("../apps/services/Logger");

describe('Harvester application', function () {

	afterEach(function() {
	  if (LOG.info.restore) {
		  LOG.info.restore();
	  }
	  if (LOG.error.restore) {
		  LOG.error.restore();
	  }
	});
	
  it.skip('save offer without error', function () {
    var spy = sinon.spy(LOG, 'info');
    var callback = sinon.spy();

    var offer = {
      'url': 'someurl'
    };

    var harvester = new Harvester();
    harvester.db = {
        'offers': {
          'save': sinon.spy()
        }
    };
    
    harvester.saveOffer(offer, callback);

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, null);
  });

  it('on site processing finished with error', function () {
    var spy = sinon.spy(LOG, 'error');
    var callback = sinon.spy();

    var harvester = new Harvester();
    harvester.onSiteProcessed(new Error('some error message'), callback);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, {"message":"Error processing site", "error":"some error message"});

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, new Error('some error message'));
  });

  it('on site processing finished without error', function () {
    var spy = sinon.spy(LOG, 'info');
    var callback = sinon.spy();

    var harvester = new Harvester();
    harvester.onSiteProcessed(null, callback);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, 'Site processed successfully');

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, null);
  });

  it('on harvesting finished with error', function () {
    var spy = sinon.spy(LOG, 'error');
    var callback = sinon.spy();

    var harvester = new Harvester();
    harvester.onHarvestingFinished(new Error('some error message'), callback);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, {"message":"Harvesting failed","error":"some error message"});

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, new Error('some error message'));
  });

  it('on harvesting finished without error', function () {
    var spy = sinon.spy(LOG, 'info');
    var callback = sinon.spy();

    var harvester = new Harvester();
    harvester.onHarvestingFinished(null, callback);

    sinon.assert.calledOnce(spy);
    sinon.assert.calledWith(spy, "Harvesting finished");

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, null);
  });
});