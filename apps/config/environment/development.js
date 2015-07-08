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
    execution: {
      rule: '2 minutes' // every 2 minutes
    },
    retryTimeout: 5 * 1000,
    logs: {
      'logentries': {
        'token': '8ea9fd5d-1960-40ba-b5ec-7a00a21186bd'
      },
      'level': 'debug'
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
      rule: '2 minutes' // every 2 minutes
    }
  },
  pakkumised: false,
  activeSites: {
    'www.minuvalik.ee': false,
    'www.cherry.ee': false,
    'www.chilli.ee': false,
    'www.euronics.ee': false,
    'www.kriisis.ee': false,
    'www.onoff.ee': false
  }
};

module.exports = config;