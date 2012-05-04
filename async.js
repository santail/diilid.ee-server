var async = require('async'),
    _ = require('underscore')._;

var items = [1, 2, 3, 4, 5],
    counter = items.length

for (var i = 0, limit = items.length; i < limit; i++) {
    (function(item) {
        process.nextTick(function () {
            for(var i=0; i<1000000000; ++i){}

                console.log('processing', item)
                if (--counter === 0) {
                    console.log('done')
                }

        })

    })(items[i])
}