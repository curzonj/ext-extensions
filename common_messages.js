/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks');

SWorks.Messages = {
  alert: function(key) {
    var values = this.get(key);
    Ext.MessageBox.alert(values.title, values.message);
  },
  get: function(key) {
    if (this.messageStore) {
      return this.messageStore[key];
    }
  },
  check: function() {
    if (!this.messageStore) {
      this.messageStore = {};
    }
  },
  setWithTitle: function(key, title, msg) {
    this.check();
    this.messageStore[key] = {
      title: title,
      message: msg
    };
  },
  setString: function(value) {
    this.check();
    this.messageStore[key] = value;
  }
}
