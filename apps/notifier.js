'use strict';

var config = require('./config/environment'),
    mongojs = require("mongojs"),
    _ = require('underscore')._,
    nodemailer = require('nodemailer'),
    cron = require('cron').CronJob,
    twilio = require('twilio')(config.notifier.twilio.AccountSID, config.notifier.twilio.AuthToken);;

var Notifier = function () {
    this.db = null;
    this.smtp = null;
};

Notifier.prototype.compileEmailBody = function (offers) {

  var body = "<h1>Offers:</h1>";

  _.each(offers, function (offer) {
    body += '<p><a href="' + offer.url + '" title="' + offer.title + '" />' + offer.title + '</a> ' + offer.site + '</p>';
  });

    return '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">'
            + '<tr>'
                + '<td align="center">'
                    + '<center style="max-width: 600px; width: 100%;">'
                    + '<!--[if gte mso 9]>'
                    + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0"><tr><td>'
                    + '<![endif]-->'
                    + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">'
                      + '<tr>'
                        + '<td>'
                            + '<!--[if gte mso 9]>'
                            + '<table border="0" cellpadding="0" cellspacing="0">'
                            + '<tr><td align="center">'
                                   + '<table border="0" cellpadding="0" cellspacing="0" width="300"     align="center"><tr><td>'
                            + '<![endif]-->'

                            + '<!-- Блок номер 1 -->'
                             + '<span style="display:inline-block; width:300px;">'
                                 + body
                             + '</span>'
                            + '<!-- Блок номер 1 -->'
         + '<!--[if gte mso 9]>'
                     + '</td></tr></table>'
                 + '</td>'
                     + '<td align="center">'
                         + '<table border="0" cellpadding="0" cellspacing="0" align="center"><tr><td>'
         + '<![endif]-->'
                                + '<!-- Блок номер 2 -->'
                                 + '<span style="display:inline-block; width:300px;">'
                                      + 'Контент блока'
                                 + '</span>'
                                + '<!-- Блок номер 2 -->'
                                + '<!--[if gte mso 9]>'
                                + '</td></tr></table>'
                                + '</td>'
                                + '</tr></table>'
                                + '<![endif]-->'
                                    + '</td>'
                                + '</tr>'
                          + '</table>'
        	+ '<!--[if gte mso 9]>'
                        + '</td>'
                    + '</tr>'
                + '</table>'
            + '<![endif]-->'
             + '</center>   '
            + '</td>'
          + '</tr>'
        + '</table>';
};

Notifier.prototype.compileSmsBody = function (offers) {
  return "<h1>Offers:" + _.size(offers) + "</h1>";
};

Notifier.prototype.findWishesAndProcess = function () {
  var that = this;
  that.db.wishes.find(function (err, wishes) {

  });
};

Notifier.prototype.run = function () {
    var that = this,
        runningTime = new Date();

    console.log('Starting notifier process', that);

    that.db = mongojs.connect(config.db.url, config.db.collections);
    that.db.collection('wishes');

    that.smtp = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.notifier.gmail.user,
            pass: config.notifier.gmail.password
        }
    });

    console.log('Requesting users wishes');

    that.db.wishes.find(function (err, wishes) {
        if (err) {
            console.log('Error retrieving wishes');
        }

        console.log('Found', _.size(wishes), 'wishes, Processing');

        _.each(wishes, function (wish) {

            console.log('Searching for offers containing', wish.contains);

            that.db.offers.find({
                $text: {
                  $search: wish.contains,
                  $language: wish.language
                }
            },
            function (err, offers) {
                console.log('Found', _.size(offers), 'offers. Notifiyng user');

                console.log('Sending email to', wish.email);

                 that.smtp.sendMail({
                    from: 'notifier-robot@salestracker.eu',
                    to: wish.email,
                    subject: 'hello',
                    html: that.compileEmailBody(offers)
                },
                function (err, result) {
                    console.log('Email sent', err);
                });

                if (wish.hasPhone) {
                  twilio.sendMessage({
                    to: wish.phone,
                    from: config.notifier.twilio.from,
                    body: that.compileSmsBody(offers)
                  },
                  function(err, response) {
                    console.log(err || response);
                  });
                }

                that.db.close();
            });
        });
    });
};

Notifier.prototype.start = function (forceMode) {
  var that = this;

  console.log('Starting Notifier');

    if (forceMode) {
        that.run();
    }
    else {
        new cron(config.notifier.execution.rule, that.run.bind(that), null, true, "Europe/Tallinn");
    }
};

module.exports = Notifier;
