var imageProcessor = function (picture, finishImageProcessing) {
    console.log('processing image: ', picture)
    if (picture.url !== undefined) {
        var imageHostName = deal.url.hostname
        var imagePathName = picture.url.replace(deal.url.hostname, '');

        var imageFullPath = imageHostName + imagePathName;
        console.log('image: ', imageFullPath)

        var filename = url.parse(imageFullPath).pathname.split("/").pop()
        console.log('filename: ', filename)

        var options = {
            host: imageHostName,
            port: 80,
            path: imagePathName
        };

        var file = fs.createWriteStream(config.images.dir + deal._id + '/' + filename, {'flags':'a'});

        http.get(options, function (res) {
            console.log("File size " + filename + ": " + res.headers['content-length'] + " bytes.");

            res
                .on('data',function (data) {
                    file.write(data);
                })
                .on('end', function () {
                    file.end();
                    console.log(filename + ' downloaded to ' + DOWNLOAD_DIR);

                    new thumbbot(DOWNLOAD_DIR + filename, DOWNLOAD_DIR + filename + ".thumb", function() {
                        this.attributes
                    })

                    finishImageProcessing()
                });
        });
    }
    else {
        console.log('error reading image');
        finishImageProcessing()
    }
};

exec('mkdir -p ' + DOWNLOAD_DIR, function (err, stdout, stderr) {
    if (err) {
        console.log('Error creating directory:', err)
    }
    else {
        console.log('directory created: ', DOWNLOAD_DIR);
        async.forEachSeries(deal.pictures, imageProcessor, function (err) {
            result.items.push(deal);
            console.log('fetching images finished successfully', link)
            finishItemProcessing()
        })
    }
});