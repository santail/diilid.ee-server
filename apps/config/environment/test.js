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
    execution: {
      rule: '*/5 * * * *' // every 5 minutes
    },
    retryTimeout: 1 * 60 * 1000,
    logs: {
      'logentries': {
        'token': '35014ffd-cc1b-409c-9adb-75a639b58dde'
      }
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
      rule: '*/5 * * * *' // every 5 minutes
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
  }
};

module.exports = config;