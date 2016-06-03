var config = {
  db: {
    uri: 'mongodb://' + process.env.IP + ':27017/deals_test',
    collections: ["jobs", "offers", "sites", "wishes"]
  },
  images: {
    dir: __dirname + '/public/images/',
    thumbs: []
  },
  procurer: {
    execution: {
      rule: '11:30am' // every 2 minutes
    }
  },
  harvester: {
    proxies: [
      // 'http://46.101.248.216:8888/'
    ],
    execution: {
      rule: '30 minutes' // every 30 minutes
    },
    retryTimeout: 1 * 60 * 1000,
    requestInterval: 1 * 1000,
    logs: {
      'logentries': {
        'token': '35014ffd-cc1b-409c-9adb-75a639b58dde'
      },
      "loggly": {
        token: "86ec85e9-fada-4720-a27a-12fcf0d921a5",
        subdomain: "salestracker",
        tags: ["Harvester TEST"],
        json: true
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
      rule: '30 minutes' // every 30 minutes
    },
    logs: {
      'logentries': {
        'token': '35014ffd-cc1b-409c-9adb-75a639b58dde'
      },
      "loggly": {
        "subdomain": "nikolaimuhhin",
        "token": "baaf8934-7b4a-45ab-aa1f-688fa3e67f92",
        "tags": ["notifier: test"]
      },
      'level': 'info'
    }
  },
  activeSites: {
    'www.pakkumised.ee': false,
    'www.e-maxima.ee': true,
    'www.chilli.ee': true,
    'www.euronics.ee': true,
    'www.euronics.discount.ee': true,
    'www.euronics.outlet.ee': true,
    'www.expert.discount.ee': true,
    'www.expert.outlet.ee': true,
    'www.expert.top.ee': true,
    'www.k-rauta.ee': true,
    'www.kriisis.ee': true,
    'www.minuvalik.ee': true,
    'www.onoff.ee': true,
    'www.onoff.eshop.ee': true,
    'www.prismamarket.ee': true,
    'www.selver.ee': true
  },
  'appdynamics': {
    controllerHostName: 'paid130.saas.appdynamics.com',
    controllerPort: 443, // If SSL, be sure to enable the next line     controllerSslEnabled: true // Optional - use if connecting to controller via SSL
    accountName: 'SalesTracker',
    accountAccessKey: '09feqqad1hhn',
    applicationName: 'SalesTracker',
    tierName: 'Harvester TEST',
    nodeName: 'process' // The controller will automatically append the node name with a unique number
  }
};

module.exports = config;