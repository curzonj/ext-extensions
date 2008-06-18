/*globals Ext, SWorks */

Ext.namespace('SWorks');

SWorks.Logging = {
  init: function(url) {
    this.log_url = url;
  },
  log: function(msg, type) {
    Ext.Ajax.jsonRequest({
      loggingRequest: true,
      url: this.log_url,
      method: 'POST',
      params: {
        msg_type: type,
        message: msg
      }
    });
  },
  error: function(msg) {
    this.log(msg, 'error');
  }
}
