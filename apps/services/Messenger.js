var config = require('../config/env'),
  util = require("util"),
  _ = require('underscore')._,
  Mailgun = require('mailgun-js'),
  LOG = require("./Logger"),
  twilio = require('twilio')(config.notifier.twilio.AccountSID, config.notifier.twilio.AuthToken);

function Messenger() {
  this.init();
}

Messenger.prototype.init = function () {};

Messenger.prototype.sendEmail = function (email, offers) {
  var that = this;

  var mailgun = new Mailgun({
    apiKey: config.notifier.mailgun.api_key,
    domain: config.notifier.mailgun.domain
  });

  LOG.debug(util.format('[STATUS] [Sending] [email] [%s] Sending email', email));

  var data = {
    from: 'notifier-robot@salestracker.eu',
    to: email,
    subject: util.format('Salestracker.eu Found offers notification', ''),
    html: that.compileEmailBody(offers)
  };

  mailgun.messages().send(data, function (err, body) {
    if (err) {
      LOG.error({
        'message': util.format('[STATUS] [Failed] [email] [%s] Sending email', email),
        'error': err.message
      });

      return;
    }

    LOG.info(util.format('[STATUS] [OK] [email] [%s] Succesfully sent.', email));
  });
};

Messenger.prototype.sendSms = function (phone, offers) {
  var that = this;

  LOG.debug(util.format('[STATUS] [Sending] [SMS] [%s] Sending SMS', phone));

  twilio.sendMessage({
      to: phone,
      from: config.notifier.twilio.from,
      body: that.compileSmsBody(offers)
    },
    function (err, response) {
      if (err) {
        LOG.error({
          'message': util.format('[STATUS] [Failed] [SMS] [%s] Sending sms', phone),
          'error': err.message
        });

        return;
      }

      LOG.info(util.format('[STATUS] [OK] [SMS] [%s] Succesfully sent.', phone));
    });
};

Messenger.prototype.compileEmailBody = function (offers) {

  var body = "<h1>SalesTracker.eu has found something</h1> what could be potentially interesting to you";

  _.each(offers, function (offer) {
    body += '<p><a href="' + offer.url + '" title="' + offer.title + '" />' + offer.title + '</a> ' + offer.site + '</p>';
  });

  return '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' + '<tr>' + '<td align="center">' + '<center style="max-width: 600px; width: 100%;">' + '<!--[if gte mso 9]>' + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0"><tr><td>' + '<![endif]-->' + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' + '<tr>' + '<td>' + '<!--[if gte mso 9]>' + '<table border="0" cellpadding="0" cellspacing="0">' + '<tr><td align="center">' + '<table border="0" cellpadding="0" cellspacing="0" width="300"     align="center"><tr><td>' + '<![endif]-->'
    +'<!-- Блок номер 1 -->'
    + '<span style="display:inline-block; width:300px;">' + body + '</span>'
    + '<!-- Блок номер 1 -->'
    + '<!--[if gte mso 9]>' + '</td></tr></table>' + '</td>' + '<td align="center">' + '<table border="0" cellpadding="0" cellspacing="0" align="center"><tr><td>' + '<![endif]-->'
    + '<!-- Блок номер 2 -->'
    + '<span style="display:inline-block; width:300px;">' + 'Контент блока' + '</span>'
    + '<!-- Блок номер 2 -->'
    + '<!--[if gte mso 9]>' + '</td></tr></table>' + '</td>' + '</tr></table>' + '<![endif]-->' + '</td>' + '</tr>' + '</table>' + '<!--[if gte mso 9]>' + '</td>' + '</tr>' + '</table>' + '<![endif]-->' + '</center>   ' + '</td>' + '</tr>' + '</table>';
};

Messenger.prototype.compileSmsBody = function (offers) {
  var body = "";

  _.each(offers, function (offer) {
    body += util.format("%s: %s: %s\r\n", offer.discount, offer.title, offer.site);
  });

  return body;
};

module.exports = Messenger;