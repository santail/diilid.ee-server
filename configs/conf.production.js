    var config = {
        app: {
            port: 19603
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