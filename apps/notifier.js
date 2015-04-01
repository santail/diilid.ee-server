'use strict';

var config = require('./config/environment'),
    activeSites = config.activeSites,
    mongojs = require("mongojs"),
    async = require('async'),
    _ = require('underscore')._,
    nodemailer = require('nodemailer'),
    cron = require('cron').CronJob;

var Notifier = function () {
    this.db = null;
    this.smtp = null;
};

Notifier.prototype.compileEmailBody = function (offer) {
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
                                 + 'Контент блока'
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
        + '</table>'
};

Notifier.prototype.run = function () {
    var that = this,
        runningTime = new Date();

    console.log('Starting notifier process');

    that.db = mongojs.connect(config.db.url, config.db.collections);
    that.db.collection('wishes');

    that.smtp = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'nikolai.muhhin',
            pass: 'vkSG9667'
        }
    });

    console.log('Requesting users wishes');

    that.db.wishes.find(function (err, wishes) {
        if (err) {
            console.log('Error retrieving wishes')
        }

        console.log('Found', _.size(wishes), 'wishes, Processing');

        _.each(wishes, function (wish) {

            console.log('Searching for offers containing', wish.contains);

            that.db.offers.find({
                $or: [{
                  'title': new RegExp(wish.contains, 'i')
                }, {
                  'description.short': new RegExp(wish.contains, 'i')
                }, {
                  'description.long': new RegExp(wish.contains, 'i')
                }]
            },
            function (err, offers) {
                console.log('Found', _.size(offers), 'offers. Notifiyng user');

                _.each(offers, function (offer) {

                    console.log('Sending email to', wish.email, offer);

                     that.smtp.sendMail({
                        from: 'notifier-robot@salestracker.eu',
                        to: wish.email,
                        subject: 'hello',
                        html: that.compileEmailBody(offer)
                    },
                    function (err, result) {
                        console.log('Email sent', err);
                    });
                });
            });
        });
    });
};

Notifier.prototype.start = function (forceMode) {
    if (forceMode) {
        this.run();
    }
    else {
        new cron(config.notifier.execution.rule, this.run, null, true, "Europe/Tallinn");
    }
};

module.exports = Notifier;
