var config = {
  db: {
    uri: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/deals_development',
    collections: ["jobs", "offers", "sites", "wishes"]
  },
  images: {
    dir: __dirname + '/public/images/',
    thumbs: []
  },
  procurer: {
    execution: {
      rule: '30 seconds' // every 2 minutes
    }
  },
  harvester: {
    proxies: [
      // 'http://46.101.248.216:8888/'
    ],
    execution: {
      rule: '30 seconds' // every 2 minutes
    },
    retryTimeout: 5 * 1000,
    requestInterval: 1 * 1000,
    logs: {
      'logentries': {
        'token': '8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
      },
      "loggly": {
        token: "86ec85e9-fada-4720-a27a-12fcf0d921a5",
        subdomain: "salestracker",
        tags: ["Harvester DEV"],
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
  activeSites: {
    'www.pakkumised.ee': false,
    'www.e-maxima.ee': false,
    'www.cherry.ee': false,
    'www.chilli.ee': false,
    'www.euronics.ee': false,
    'www.kriisis.ee': false,
    'www.minuvalik.ee': false,
    'www.onoff.ee': false,
    'www.prismamarket.ee': false,
    'www.selver.ee': false
  },
  'appdynamics': {
    controllerHostName: 'paid130.saas.appdynamics.com',
    controllerPort: 443, // If SSL, be sure to enable the next line     controllerSslEnabled: true // Optional - use if connecting to controller via SSL
    accountName: 'SalesTracker',
    accountAccessKey: '09feqqad1hhn',
    applicationName: 'SalesTracker',
    tierName: 'Harvester DEV',
    nodeName: 'process' // The controller will automatically append the node name with a unique number
  }
};

module.exports = config;