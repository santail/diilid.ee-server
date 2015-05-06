var config = require('./environment'),
    mongojs = require("mongojs"),
    _ = require('underscore')._;

var db = mongojs.connect(config.db.url, config.db.collections);
db.collection('wishes');

db.wishes.remove({});

db.wishes.insert([{
    contains: 'суши',
    email: 'nikolai.muhhin@gmail.com',
    hasPhone: true,
    phone: '+37253003125',
    language: 'ru'
  }], function (err) {
    console.log('Seeding finished', err);
  });

db.close();