var config = {
    app: {
        port: 19603
    },
    db: {
        url: 'mongodb://deals:offers@staff.mongohq.com:10020/deals',
        collections: ["offers", "notifications"]
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
    activeSites: {
        // 'www.minuvalik.ee': true,
        'www.cherry.ee': true
    }
};

module.exports = config;