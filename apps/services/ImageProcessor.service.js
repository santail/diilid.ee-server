(function() {

    var ImageProcessor = {}

    ImageProcessor.processor = function (picture, callback) {
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

                        callback()
                    });
            });
        }
        else {
            console.log('error reading image');
            callback()
        }
    }

    ImageProcessor.process = function(destination, pictures, callback) {
        exec('mkdir -p ' + destination, function (err, stdout, stderr) {
            if (err) {
                console.log('Error creating directory:', err)
            }
            else {
                console.log('directory created: ', destination);
                async.forEachSeries(pictures, function() {
                    console.log('test')
                }, function (err) {
                    if (err) {
                        console.log('Error processing images: ', err)
                    }

                    console.log('fetching images finished successfully')
                    callback()
                })
            }
        })
    }
}())


