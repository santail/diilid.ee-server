var config = {
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
    }
};

module.exports = config;