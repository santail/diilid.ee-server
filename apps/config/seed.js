var config = require('./environment'),
    mongojs = require("mongojs"),
    _ = require('underscore')._;

var db = mongojs.connect(config.db.url, config.db.collections);
db.collection('wishes');

db.wishes.insert([{
    contains: 'sushi',
    hasEmail: true,
    email: 'nikolai.muhhin@gmail.com',
    hasPhone: true,
    phone: '+37253003125'
  }, {
    contains: 'pizza',
    hasEmail: true,
    email: 'nikolai.muhhin@swedbank.ee',
    hasPhone: false,
    phone: null
  }], function (result) {
    console.log('Seeding finished', result);

  });

db.close();