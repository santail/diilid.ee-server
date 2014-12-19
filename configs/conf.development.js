var config = {
    app: {
      port: process.env.PORT || 3000,
      ip: process.env.IP || '0.0.0.0'
    }
    , db: {
        url: '127.2.91.1:27017/deals',
        collections: ["offers"]
    }
    , images: {
        dir: __dirname + '/public/images/'
        , thumbs: []
    }
}

module.exports = config