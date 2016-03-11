var config = {
  db: {
    uri: 'mongodb://' + process.env.IP + ':27017/deals',
    collections: ["jobs", "offers", "sites", "wishes"]
  },
  images: {
    dir: __dirname + '/public/images/',
    thumbs: []
  },
  procurer: {
    execution: {
      rule: '11:30am' // every 3 hours
    }
  },
  harvester: {
    proxies: [
      // 'http://46.101.248.216:8888/'
    ],
    execution: {
      rule: '3 hours' // every 3 hours
    },
    retryTimeout: 5 * 60 * 1000,
    requestInterval: 1 * 1000,
    logs: {
      'logentries': {
        'token': '8f74bbd5-354c-4f71-a9d9-ffc3d4d179b3'
      },
      "loggly": {
        token: "86ec85e9-fada-4720-a27a-12fcf0d921a5",
        subdomain: "salestracker",
        tags: ["Harvester PRODUCTION"],
        json: true
      },
      'level': 'info'
    }
  },
  notifier: {
    twilio: {
      AccountSID: 'AC47db10149694cab9cf625c58803650d3',
      AuthToken: '4f0ae099ee487367e6f9d6b6e5c7bd8d',
      from: '+37259120110'
    },
    mailgun: {
      api_key: 'key-ae63224be01baeeec348c3c1808f058a',
      domain: 'sandbox128a26d04fa443169a9f8a674e69d3bb.mailgun.org'
    },
    execution: {
      rule: '3 hours' // every 3 hours
    },
    logs: {
      'logentries': {
        'token': '8f74bbd5-354c-4f71-a9d9-ffc3d4d179b3'
      },
      "loggly": {
        "subdomain": "nikolaimuhhin",
        "token": "baaf8934-7b4a-45ab-aa1f-688fa3e67f92",
        "tags": ["notifier: production"]
      },
      'level': 'info'
    }
  },
  activeSites: {
    'www.pakkumised.ee': false,
    'www.e-maxima.ee': true,
    'www.cherry.ee': true,
    'www.chilli.ee': true,
    'www.euronics.ee': true,
    'www.kriisis.ee': true,
    'www.minuvalik.ee': true,
    'www.onoff.ee': true,
    'www.prismamarket.ee': true,
    'www.selver.ee': true
  },
  'appdynamics': {
    controllerHostName: 'paid130.saas.appdynamics.com',
    controllerPort: 443, // If SSL, be sure to enable the next line     controllerSslEnabled: true // Optional - use if connecting to controller via SSL
    accountName: 'SalesTracker',
    accountAccessKey: '09feqqad1hhn',
    applicationName: 'SalesTracker',
    tierName: 'Harvester LIVE',
    nodeName: 'process' // The controller will automatically append the node name with a unique number
  }
};

module.exports = config;