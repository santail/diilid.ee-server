var config = {
  db: {
    uri: 'mongodb://' + process.env.IP + ':27017/deals',
    collections: ["offers", "notifications", "wishes"]
  },
  images: {
    dir: __dirname + '/public/images/',
    thumbs: []
  },
  harvester: {
    execution: {
      rule: '0 */3 * * *' // every 3 hours
    },
    retryTimeout: 5 * 60 * 1000,
    logs: {
      'logentries': {
        'token': '8f74bbd5-354c-4f71-a9d9-ffc3d4d179b3'
      },
      'level': 'info'
    }
  },
  notifier: {
    twilio: {
      AccountSID: 'AC47db10149694cab9cf625c58803650d3',
      AuthToken: 'd7450e5f6822e896440007633e88d8ee',
      from: '+37259120110'
    },
    gmail: {
      user: 'nikolai.muhhin',
      password: 'vkSG9667'
    },
    execution: {
      rule: '0 */3 * * *' // every 3 hours
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