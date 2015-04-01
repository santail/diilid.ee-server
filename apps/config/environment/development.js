var config = {
    db: {
        url: 'mongodb://deals:offers@dogen.mongohq.com:10063/deals_server_development',
        collections: ["offers", "notifications", "wishes"]
    },
    images: {
        dir: __dirname + '/public/images/',
        thumbs: []
    },
    harvester: {
        execution: {
            rule: '*/5 * * * *' // every 5 minutes
        }
    },
    notifier: {
        execution: {
            rule: '0/5 * * * *' // every 5 minutes
        }
    },
    pakkumised: false,
    activeSites: {
      'www.minuvalik.ee': false,
      'www.cherry.ee': false,
      'www.euronics.ee': false,
      'www.kriisis.ee': false,
      'www.onoff.ee': false
    }
};

module.exports = config;