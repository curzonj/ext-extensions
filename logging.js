/*globals Ext, SWorks */

Ext.namespace('SWorks');

SWorks.Logging = {
  log: function(msg, type) {
    Ext.Ajax.jsonRequest({
      url: URLs.log_records,
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
