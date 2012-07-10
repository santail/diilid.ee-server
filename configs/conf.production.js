    var config = {
        app: {
            port: 19603
        }
        , db: {
            url: 'mongodb://deals:offers@staff.mongohq.com:10020/deals'
            , collections: ["offers"]
        }
        , images: {
            dir: __dirname + '/public/images/'
            , thumbs: []
        }
    }

    module.exports = config