'use strict';

var config = require('../config/env'),
  LOG = require("../services/Logger"),
  mongojs = require('mongojs'),
  monq = require('monq');

function Sessionfactory() {
    LOG.debug('Connecting to database', config.db.uri);

    this.db = mongojs(config.db.uri, config.db.collections);
    this.client = monq(config.db.uri, { safe: true });
}

Sessionfactory.prototype.getDbConnection = function () {
  return this.db;
};

Sessionfactory.prototype.getQueueConnection = function (queue) {
  return this.client.queue(queue);
};

Sessionfactory.prototype.getWorkerConnection = function (queues) {
  return this.client.worker(queues);
};

var sessionFactory = new Sessionfactory();

module.exports = {
  getDbConnection: sessionFactory.getDbConnection.bind(sessionFactory),
  getQueueConnection: sessionFactory.getQueueConnection.bind(sessionFactory),
  getWorkerConnection: sessionFactory.getWorkerConnection.bind(sessionFactory)
};
