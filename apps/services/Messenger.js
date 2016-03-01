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

Messenger.prototype.send = function (notification, callback) {
  var that = this;

  that.sendEmail(notification);

  if (notification.phone) {
    that.sendSms(notification.phone, notification.offers);
  }

  callback();
};

Messenger.prototype.sendEmail = function (notification) {
  var that = this;

  var mailgun = new Mailgun({
    apiKey: config.notifier.mailgun.api_key,
    domain: config.notifier.mailgun.domain
  });

  LOG.debug(util.format('[STATUS] [Sending] [email] [%s] Sending email', notification.email));

  var data = {
    from: 'notifier-robot@salestracker.eu',
    to: notification.email,
    subject: util.format('Salestracker.eu Found offers notification', ''),
    html: that.compileEmailBody(notification)
  };

  mailgun.messages().send(data, function (err, body) {
    if (err) {
      LOG.error({
        'message': util.format('[STATUS] [Failed] [email] [%s] Sending email', notification.email),
        'error': err.message
      });

      return;
    }

    LOG.info(util.format('[STATUS] [OK] [email] [%s] Succesfully sent.', notification.email));
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

Messenger.prototype.compileEmailBody = function (notification) {

  var content = "<h1>SalesTracker.eu has found something</h1> what could be potentially interesting to you";

  content += util.format("<h2>You have been searching for '%s'</h2>", notification.contains);

  _.each(notification.offers, function (offer) {
    var details = '';

    if (offer.vendor) {
      details += util.format('<span>%s</span>', offer.vendor);
    }
    
    details += util.format(' <span style="text: bold;">%s</span>', offer.price);

    if (offer.original_price) {
     details += util.format('<span style="text-decoration: line-through;">%s</span>', offer.original_price);
    }

    if (offer.description) {
      details += util.format('<br /><span>%s</span>',  offer.description);
    }

    content += util.format('<p><a href="%s" title="%s" />%s</a> %s</p>', offer.url, offer.title, offer.title, details);
  });

  return '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' +
  '<tr>' +
  '<td align="center">' +
  '<center style="max-width: 600px; width: 100%;">' +
  '<!--[if gte mso 9]>' +
  '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0">' +
  '<tr>' +
  '<td>' +
  '<![endif]-->' +
  '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' +
    '<tr>' +
      '<td>' +
        '<!--[if gte mso 9]>' +
        '<table border="0" cellpadding="0" cellspacing="0">' +
          '<tr>' +
            '<td align="center">' +
              '<table border="0" cellpadding="0" cellspacing="0" width="600" align="center">' +
                '<tr>' +
                  '<td>' +
                  '<![endif]-->' +
                    '<!-- Блок номер 1 -->' +
                    '<span style="display:inline-block; width:600px;">' + content + '</span>' +
                    '<!-- Блок номер 1 -->' +
                  '<!--[if gte mso 9]>' +
                  '</td>' +
                '</tr>' +
              '</table>' +
            '</td>' +
            /*
            '<td align="center">' +
              '<table border="0" cellpadding="0" cellspacing="0" align="center">' +
                '<tr>' +
                  '<td>' +
                  '<![endif]-->' +
                    '<!-- Блок номер 2 -->' +
                    '<span style="display:inline-block; width:300px;">' + 'Контент блока' + '</span>' +
                    '<!-- Блок номер 2 -->' +
                  '<!--[if gte mso 9]>' +
                  '</td>' +
                '</tr>' +
              '</table>' +
            '</td>' +
            */
          '</tr>' +
        '</table>' +
        '<![endif]-->' +
      '</td>' +
    '</tr>' +
  '</table>' +
  '<!--[if gte mso 9]>' +
  '</td>' +
  '</tr>' +
  '</table>' +
  '<![endif]-->' +
  '</center>' +
  '</td>' +
  '</tr>' +
  '</table>';
};

Messenger.prototype.compileSmsBody = function (offers) {
  var body = "";

  _.each(offers, function (offer) {
    body += util.format("%s: %s: %s\r\n\r\n", offer.sales, offer.title, offer.shop);
  });

  return body;
};

module.exports = Messenger;