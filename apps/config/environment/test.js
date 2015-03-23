var config = {

    db: {
        url: 'mongodb://deals:offers@staff.mongohq.com:10020/deals_test',
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
    activeSites: {
        'www.minuvalik.ee': true,
        'www.cherry.ee': true
    }
};

module.exports = config;