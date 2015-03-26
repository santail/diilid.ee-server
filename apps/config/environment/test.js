var config = {

    db: {
        url: 'mongodb://deals:offers@dogen.mongohq.com:10094/deals_server_test',
        collections: ["offers", "notifications"]
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
            rule: '*/5 * * * *' // every 5 minutes
        }
    },
    pakkumised: false,
    activeSites: {
      'www.minuvalik.ee': true,
      'www.cherry.ee': true,
      'www.euronics.ee': true,
      'www.kriisis.ee': true
    }
};

module.exports = config;