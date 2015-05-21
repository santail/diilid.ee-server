var config = {
  db: {
    url: 'mongodb://deals:offers@staff.mongohq.com:10020/deals',
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
    retryTimeout: 5 * 60 * 1000
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