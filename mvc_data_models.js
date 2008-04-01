SWorks.DataModel = function(overrides) {
  Ext.apply(this, overrides);
}
Ext.extend(SWorks.DataModel, Ext.util.Observable, {

  newRecord: function(data, initRecord) {
    var record = new this.recordType(data || {});
    record.id = 'new';
    record.newRecord = true;

    if(initRecord !== false) {
      var keys = record.fields.keys;
      for(var i = 0, len = keys.length; i < len; i++){
        if(typeof record.data[keys[i]] == "undefined") {
          record.data[keys[i]] = "";
        }
      }

      this.initializeRecord(record);
    }

    return record;
  },

  deleteRecord: function(record, cb, scope){
    this.deleteRecordById(record.id, cb, scope);
  },
  deleteRecordById: function(id, cb, scope){
    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record to delete
    if(this.restUrl) {
      Ext.Ajax.request({
        cb: {
          fn: cb,
          scope: scope || this
        },
        deleting_id: id,
        url: String.format(this.restUrl, id),
        method: "DELETE",
        callback: this.onDeleteById,
        scope: this
      });
    }
  },
  onDeleteById: function(options, success, response) {
    var result = null, id = options.deleting_id;
    if(success) {
      result =  Ext.decode(response.responseText);
    }

    if (success && result.success) {
      if(options.cb.fn) {
        options.cb.fn.call(options.cb.scope);
      }
      this.fireEvent('delete', id);
    } else {
      var msg = (result && result.msg ? result.msg : "Failed to delete the record. Please try again.");
      Ext.MessageBox.alert('Delete failed', msg);
    }

    return result;
  }

  saveRecord: function(o) {
    // Options: record, callback
    if(o.record && !o.record.data) {
      o.record = this.newRecord(o.record, false);
    }

    o = this.setUpdateOrCreate(o.record, o);
    Ext.applyIf(o.params, this.serializeRecord(o.record));

    this.postToRecord(o.record.id, o);
  },
  updateAttribute: function(options) {
    /* options:
     *   id: id of the record you want to update
     *   field: the model attribute to update
     *   value: the new value
     */

     var id = options.id || options.record.id;

     options.params = {
       '_method': 'put'
     };

     if(options.field) {
       var key = String.format(this.parameterTemplate, options.field);

       if(options.record && typeof options.value == 'undefined') {
         options.value = options.record.get(options.field);
       }
       options.params[key] =  options.value;
     }

     this.postToRecord(id, options);
  },
  setUpdateOrCreate: function(record, o) {
    o = o || {};
    o.params = o.params || {};
    
    if(record.newRecord) {
      Ext.applyIf(o, { url: this.createUrl});
      Ext.applyIf(o.params, { '_method': 'post'});
    } else {
      Ext.applyIf(o, { url: String.format(this.restUrl, record.id)});
      Ext.applyIf(o.params, { '_method': 'put'});
    }

    return o;
  },
  serializeRecord: function(record) {
    var values = {};
    var data = record.data || record;
    var fields = this.serializedFields || record.fields.keys;
    for(var i=0;i<fields.length;i++) {
      var key = String.format(this.parameterTemplate, fields[i]);
      var value = data[fields[i]];
      if(typeof value != "undefined" && fields[i] != 'id' && fields[i] != 'type') {
        values[key] = value;
      }
    }

    return values;
  },
  postToRecord: function(rid, o) {
    if(typeof rid == 'object') {
      o = rid;
      rid = o.id;
    } else if(typeof rid == 'undefined') {
      Ext.MessageBox.alert('Operation failed', "There was an internal error. Please report the issue and reload the application");
    }

    if(o.waitMsg !== false) {
      Ext.MessageBox.wait(o.waitMsg || "Updating Record...");
    }

    // TODO add a retry mechanism

    if(!o.url && o.record) {
      o = this.setUpdateOrCreate(o.record, o);
    } else {
      o.url = o.url || String.format(this.restUrl, rid);
    }

    o.errmsg = o.errmsg || "Failed update the record. Please try again.";
    o.cb = {
      fn: o.callback,
      scope: o.scope
    };

    Ext.Ajax.request(Ext.apply(o, {
      callback: this.postToRecordCallback,
      scope: this
    }));
  },
  postToRecordCallback: function(options, success, response) {
    if(options.waitMsg !== false) {
      Ext.MessageBox.updateProgress(1);
      Ext.MessageBox.hide();
    }

    var result = null;
    if(success) {
      result =  Ext.decode(response.responseText);
    }

    var record = options.record;
    if (success && result.success) {
      if(record) {
        if(record.store) {
          record = record.store.getById(record.id);
        }
        this.updateRecord(record, result);
      } else {
        record = new this.recordType(result.data, result.objectid);
      }
     
      if(options.cb.fn) { 
        options.cb.fn.call(options.cb.scope || this, true, record, result);
      }
      this.fireEvent('save', record, result);
      record.newBeforeSave = false;
    } else {
      if(options.cb.fn) { 
        options.cb.fn.call(options.cb.scope || this, false, record, result);
      }

      var msg = ((result && result.errors) ? (result.errors.base || options.errmsg) : options.errmsg);
      Ext.MessageBox.alert('Operation failed', msg);
    }
  },


});
