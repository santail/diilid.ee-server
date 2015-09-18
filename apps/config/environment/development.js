var config = {
  db: {
    uri: 'mongodb://' + process.env.IP + ':27017/deals_development',
    collections: ["offers", "notifications", "wishes"]
  },
  images: {
    dir: __dirname + '/public/images/',
    thumbs: []
  },
  harvester: {
    proxies: [
      // 'http://46.101.248.216:8888/'
    ],
    execution: {
      rule: '10 minutes' // every 2 minutes
    },
    retryTimeout: 5 * 1000,
    requestInterval: 1 * 1000,
    logs: {
      'logentries': {
        'token': '8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
      },
      "loggly": {
        "subdomain": "nikolaimuhhin",
        "token": "baaf8934-7b4a-45ab-aa1f-688fa3e67f92",
        "tags": ["harvester: development"]
      },
      'level': 'info'
    }
  },
  notifier: {
    twilio: {
      AccountSID: 'ACd1bf8420ca6755efc182e1f96068177d',
      AuthToken: 'aea7130ceb8f49b9937bdb7f11f063ca',
      from: '+15005550006'
    },
    mailgun: {
      api_key: 'key-ae63224be01baeeec348c3c1808f058a',
      domain: 'sandbox128a26d04fa443169a9f8a674e69d3bb.mailgun.org'
    },
    execution: {
      rule: '2 minutes' // every 2 minutes
    },
    logs: {
      'logentries': {
        'token': '8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
      },
      "loggly": {
        "subdomain": "nikolaimuhhin",
        "token": "baaf8934-7b4a-45ab-aa1f-688fa3e67f92",
        "tags": ["notifier: " + this.env]
      },
      'level': 'debug'
    }
  },
  pakkumised: false,
  activeSites: {
    'www.minuvalik.ee': false,
    'www.cherry.ee': false,
    'www.chilli.ee': false,
    'www.euronics.ee': true,
    'www.kriisis.ee': false,
    'www.onoff.ee': false
  }
};

module.exports = config;