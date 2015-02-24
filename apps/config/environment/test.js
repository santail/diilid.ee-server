var config = {
    app: {
        port: process.env.PORT || 3000,
        ip: process.env.IP || '0.0.0.0'
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