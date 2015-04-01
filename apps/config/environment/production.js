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
        }
    },
    notifier: {
        execution: {
            rule: '0 */3 * * *' // every 3 hours
        }
    },
    pakkumised: false,
    activeSites: {
      'www.minuvalik.ee': true,
      'www.cherry.ee': true,
      'www.euronics.ee': true,
      'www.kriisis.ee': true,
      'www.onoff.ee': true
    }
};

module.exports = config;