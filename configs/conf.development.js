var config = {
    app: {
      port: 3000
    }
    , db: {
        url: 'deals'
        , collections: ["offers"]
    }
    , images: {
        dir: __dirname + '/public/images/'
        , thumbs: []
    }
}

module.exports = config