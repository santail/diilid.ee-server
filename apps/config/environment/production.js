var config = {
    app: {
        port: 19603
    },
    db: {
        url: 'mongodb://deals:offers@staff.mongohq.com:10020/deals',
        collections: ["offers"]
    },
    images: {
        dir: __dirname + '/public/images/',
        thumbs: []
    },
    activeSites: {
        'www.minuvalik.ee': true,
        'www.cherry.ee': true
    }
}

module.exports = config