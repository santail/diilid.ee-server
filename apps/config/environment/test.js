var config = {
  db: {
    uri: 'mongodb://' + process.env.IP + ':27017/deals_test',
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
          json:true
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
    gmail: {
      user: 'nikolai.muhhin',
      password: 'vkSG9667'
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
  pakkumised: false,
  activeSites: {
    'www.minuvalik.ee': true,
    'www.cherry.ee': true,
    'www.chilli.ee': true,
    'www.euronics.ee': true,
    'www.kriisis.ee': true,
    'www.onoff.ee': true
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