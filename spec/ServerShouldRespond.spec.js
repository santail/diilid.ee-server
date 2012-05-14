var APP_URL = 'http://localhost:3000'
    , app = require('../app.js')
    , request = require('request')

describe("Server", function() {
    var url;

    describe("GET /", function() {
        beforeEach(function() {
            url = APP_URL + '/';
        });

        it("should respond with a 200", function() {
            request(url, function(err, res) {
                expect(res.statusCode).toEqual(200);
                asyncSpecDone();
            });
        }, 200);

        asyncSpecWait();
    });
});

