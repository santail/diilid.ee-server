var config = {
    db: {
        url: 'mongodb://deals:offers@dogen.mongohq.com:10063/deals_server_development',
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
            rule: '0/5 * * * *' // every 5 minutes
        }
    },
    activeSites: {
        'www.minuvalik.ee': true,
        'www.cherry.ee': true
    }
};

module.exports = config;