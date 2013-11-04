var config = {
    app: {
      port: 3000
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