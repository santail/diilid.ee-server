var config = require('../config/environment'),
  _ = require('underscore')._,
  Mailgun = require('mailgun-js'),
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
  console.log('Sending email to', email);
  var data = {
    from: 'notifier-robot@salestracker.eu',
    to: email,
    subject: 'hello',
    html: that.compileEmailBody(offers)
  };

  //Invokes the method to send emails given the above data with the helper library
  mailgun.messages().send(data, function (err, body) {
    //If there is an error, render the error page
    if (err) {
      console.log("got an error: ", err);
    }
    else {
      console.log(body);
    }
  });
};

Messenger.prototype.sendSms = function (phone, offers) {
  var that = this;

  twilio.sendMessage({
      to: phone,
      from: config.notifier.twilio.from,
      body: that.compileSmsBody(offers)
    },
    function (err, response) {
      console.log(err || response);
    });
};

Messenger.prototype.compileEmailBody = function (offers) {

  var body = "<h1>Offers:</h1>";

  _.each(offers, function (offer) {
    body += '<p><a href="' + offer.url + '" title="' + offer.title + '" />' + offer.title + '</a> ' + offer.site + '</p>';
  });

  return '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' + '<tr>' + '<td align="center">' + '<center style="max-width: 600px; width: 100%;">' + '<!--[if gte mso 9]>' + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0"><tr><td>' + '<![endif]-->' + '<table border="0" cellpadding="0" cellspacing="0" style="margin:0; padding:0" width="100%">' + '<tr>' + '<td>' + '<!--[if gte mso 9]>' + '<table border="0" cellpadding="0" cellspacing="0">' + '<tr><td align="center">' + '<table border="0" cellpadding="0" cellspacing="0" width="300"     align="center"><tr><td>' + '<![endif]-->'

  +'<!-- Блок номер 1 -->' + '<span style="display:inline-block; width:300px;">' + body
    + '</span>' + '<!-- Блок номер 1 -->' + '<!--[if gte mso 9]>' + '</td></tr></table>' + '</td>' + '<td align="center">' + '<table border="0" cellpadding="0" cellspacing="0" align="center"><tr><td>' + '<![endif]-->' + '<!-- Блок номер 2 -->' + '<span style="display:inline-block; width:300px;">' + 'Контент блока' + '</span>' + '<!-- Блок номер 2 -->' + '<!--[if gte mso 9]>' + '</td></tr></table>' + '</td>' + '</tr></table>' + '<![endif]-->' + '</td>' + '</tr>' + '</table>' + '<!--[if gte mso 9]>' + '</td>' + '</tr>' + '</table>' + '<![endif]-->' + '</center>   ' + '</td>' + '</tr>' + '</table>';
};

Messenger.prototype.compileSmsBody = function (offers) {
  return "<h1>Offers:" + _.size(offers) + "</h1>";
};

module.exports = Messenger;