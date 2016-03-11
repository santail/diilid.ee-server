module.exports.createSingleUseCallback = function (callback) {
  var that = this;

  function callbackWrapper() {
    var ret = callback.apply(that, arguments);
    callback = null;
    return ret;
  }

  return callbackWrapper;
};

module.exports.unleakString = function(s) {
  return (' ' + (s || '').replace('&amp;', '&')).substr(1);
};