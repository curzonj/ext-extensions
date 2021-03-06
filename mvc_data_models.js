/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks');

SWorks.DataModel = function(overrides) {
  Ext.apply(this, overrides);

  SWorks.DataModel.superclass.constructor.call(this);

  this.addEvents('beforeload', 'load', 'delete', 'save');
};
Ext.extend(SWorks.DataModel, Ext.util.Observable, {
  buildRecord: function(data, id) {
    var record = new this.recordType(data, id);
    record.json = data;

    return record;
  },

  /*
   * Updating and saving records
   *
   */
  saveRecord: function(o) {
    // Options: record, callback
    if(o.record && !o.record.data) {
      o.record = this.newRecord(o.record, false);
    }

    o.params = o.params || {};
    Ext.applyIf(o.params, this.serializeRecord(o.record));

    this.postToRecord(o);
  },
  sendEvent: function(record, eventName){
    this.postToRecord(record.id, {
      record: record,
      params: {
        'event': eventName,
        '_method': 'put'
      }
    });
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
      // If we retry create requests, we could end up with
      // multiple entries
      Ext.applyIf(o, { url: this.createUrl});
      Ext.applyIf(o.params, { '_method': 'post'});
    } else {
      // Only retry the request if it is idempotent
      o.forceRetryRequest = true;
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
    if(typeof rid == 'object' && rid !== null) {
      o = rid;
      rid = o.id;
    } else if((typeof rid == 'string' && isNaN(rid)) || typeof rid != 'number') {
      // It may not be fatal, so don't die. But it's not right.
      console.error("rid argument to postToRecord should be numeric: "+rid);
    }

    if (this.controller.isReadOnly()) {
      SWorks.Messages.alert('readonly');
      return;
    }

    if(o.waitMsg !== false) {
      Ext.MessageBox.wait(o.waitMsg || "Updating Record...");
    }

    if(!o.url && o.record) {
      o = this.setUpdateOrCreate(o.record, o);
    } else {
      if(rid) {
        o.url = o.url || String.format(this.restUrl, rid);
      } else {
        o.url = this.createUrl;
      }
    }

    o.cb = {
      fn: o.callback,
      scope: o.scope
    };

    Ext.Ajax.jsonRequest(Ext.apply(o, {
      callback: this.postToRecordCallback,
      scope: this
    }));
  },
  postToRecordCallback: function(result, options, response) {
    if(options.waitMsg !== false) {
      Ext.MessageBox.updateProgress(1);
      Ext.MessageBox.hide();
    }

    var record = options.record;
    if (result.success) {
      if(record) {
        if(record.store) {
          var reloaded_record = record.store.getById(result.objectid);
          if (reloaded_record) {
            record = reloaded_record;
          }
        }
        this.updateRecord(record, result);
      } else {
        record = this.buildRecord(result.data, result.objectid);
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

      var err = result.errors, messages = [];
      if (err) {
        for (var msg in err) {
          if (typeof err[msg] == 'string') {
            messages.push(result.errors[msg]);
          }
        }
      }

      if (messages.length > 0) {
        messages.push('If the issues persists, please report it.');
        Ext.MessageBox.alert('Save failed', messages.join(', '));
      } else {
        SWorks.ErrorHandling.serverError(response, result);
      }
    }
  },

  /*
   * Save from a form
   *
   */
  saveForm: function(form, o){
    o = o || {};

    if (this.controller.isReadOnly(form)) {
      SWorks.Messages.alert('readonly');
      return;
    }

    // Did they already submit?
    if (form.submitLock) {
      // Prevents errors from holding the enter key
      // down too long or bouncing it
      return;
    } else {
      form.submitLock = true;
    }

    // Is the form valid?
    if(!form.isValid()) {
      // This follows the Ext api for an invalid form,
      // we're just doing a precheck
      this.formFailure(form, { failureType: 'client', options: o });
      return;
    }

    this.dealWithEmptyCombos(form);

    // Then lets prepare the submit
    var record = form.record;
    o = this.setUpdateOrCreate(record, o);
    if(typeof o.waitMsg == 'undefined') {
      o.waitMsg = o.waitMsg || "Saving record...";
    }

    if(this.foreignKey) {
      Ext.applyIf(o.params, this.getParentRelation(form));
    }

    if(o.callback) {
      o.cb = {
        fn: o.callback,
        scope: o.scope
      };
      delete o.callback;
      delete o.scope;
    }

    // This way we know what we sent to the server
    o.dataSentRecord = record.copy();
    form.updateRecord(o.dataSentRecord);

    form.submit(Ext.apply(o ,{
      success: this.formSuccess,
      failure: this.formFailure,
      scope: this
    }));
  },
  dealWithEmptyCombos: function(form) {
    var el = form.el.dom.elements;
    for(var i=0;i<el.length;i++) {
      var value = el[i].value;
      if(el[i].value == "Select one..." && el[i].name) {
        el[i].value = "";
      }
    }
  },
  getParentKeys: function() {
    var values = {};

    if (this.foreignKey && this.controller && this.controller.parentForm) {
      var parentRecord = this.controller.parentForm.record;

      values[this.foreignKey] = parentRecord.id;

      var typeColumn = this.foreignKey.replace(/id/, "type");
      if (this.recordType.prototype.fields.keys.indexOf(typeColumn) != -1) {
        values[typeColumn] = parentRecord.getKlass();
      }
    }

    return values;
  },
  getParentRelation: function(form) {
    var values = {};

    var set = this.getParentKeys();
    for(var field in set) {
      var railsField = String.format(this.parameterTemplate, field);
      values[railsField] = set[field];
    }

    return values;
  },
  checkServerChanges: function(form, action) {
    // The server may not return the same data we sent it,
    // we need to respect any changes it made. Don't reload
    // the form with everything sent back from the server because
    // the user might have made changes. updateOriginalValues marks
    // that any user changes are still dirty, but only the server
    // changes need to be updated in the form.
    var r = action.options.dataSentRecord;
    var d = action.result.data;

    form.items.each(function(f) {
      var key = (f.dataIndex || f.name);

      if (typeof r.data[key] != 'undefined' &&
            r.data[key] != d[key]) {
        f.setValue(d[key]);
      }
    });
  },
  formSuccess: function(form, action) {
    if(action.result) { //should never be false, but who knows
      // Reload our record because it might be too old
      var record = form.record;
      if(!record.newRecord && record.store) {
        var reloaded_record = record.store.getById(action.result.objectid);
        if(reloaded_record) {
          // Fetched records may not be in the store they belong to
          record = form.record = reloaded_record;
        }
      }
  
      if(action.result.data) {
        form.updateOriginalValues(action.result.data);
      }
      if(record.newRecord) {
        // The action object will disappear so 
        // we don't need to clean this up. The actioncomplete
        // listeners will fire after we return
        action.newBeforeSave = true;
      }

      this.checkServerChanges(form, action);
      this.updateRecord(record, action.result);

      if(action.options.cb) {
        action.options.cb.fn.call(action.options.cb.scope, form, action);
      }
      this.fireEvent('save', form.record, action.result);
      form.record.newBeforeSave = false;
    }

    form.submitLock = false;
  },
  formFailure: function(form, action) {
    var res = action.result;

    if (action.failureType != 'server' &&
        action.failureType != 'client'     ) {
      SWorks.ErrorHandling.serverError(action.response, res);
    } else {
      var displayed = false;

      if (action.failureType == 'server') {
        var messages = action.form.extractUnreportedErrors(res.errors);

        if (messages.length > 0) {
          messages.push('If the issues persists, please report it.');
          Ext.MessageBox.alert('Save failed', messages.join(', '));
          displayed = true;
        }
      }

      if (!displayed && action.options.waitMsg !== false) {
        Ext.MessageBox.alert('Save failed',
          'Please fix all the boxes highlighted in red.');
      }
    }

    // Ext will display our validation errors from JsonController.
    // Read http://extjs.com/deploy/ext/docs/output/Ext.form.TextField.html#config-msgTarget
    // for more information about your options for styling error messages.
    // We should however keep the styling consistant across all our modules
    
    form.submitLock = false;
  },
  updateRecord: function(record, result) {
    if( result.hidden ) {
      if ( !record.newRecord &&
           record.store &&
           record.store.getById(record.id) )  {
        record.store.remove(record);
      }
    } else {
      if(record.newRecord) {
        record.id = result.objectid;
        record.newRecord = false;
        record.newBeforeSave = true;
      }
  
      record.setAttributes(result.data);
      record.commit();
    }
  },

  /*
   * Load records
   *
   */
  loadData: function(data, id) {
    var r = this.buildRecord(data, id);
    this.loadRecord(r);
  },
  loadForm: function(form, record){
    form.record = record;

    if(this.fireEvent('beforeload', form, record) !== false) {

      this.onLoadForm(form, record);
      this.fireEvent('load', form, record);

      return true;
    } else {
      return false;
    }
  },
  onLoadForm: function(form, record) {
    form.trackResetOnLoad = true;
    form.loadRecord(record);
    form.clearInvalid();
  },
  fetchRecord: function(id, o) {
    if(id) {
      o.cb = {
        fn: o.callback,
        scope: o.scope
      };

      if (o.waitMsg !== false) {
        Ext.MessageBox.wait(o.waitMsg || "Loading Record...");
      }

      Ext.Ajax.jsonRequest(Ext.apply(o, {
        url: String.format(this.restUrl, id),
        callback: this.onFetchRecordResponse,
        scope: this
      }));
    } else {
      SWorks.ErrorHandling.clientError();
    }
  },
  onFetchRecordResponse: function(result, options, response) {
    Ext.MessageBox.updateProgress(1);
    Ext.MessageBox.hide();

    if (result.success) {
      var record = this.buildRecord(result.data, result.objectid);
      options.cb.fn.call(options.cb.scope || this, record);
    } else {
      SWorks.ErrorHandling.serverError(response, result);
    }
  },

  /*
   * Create new records
   *
   */
  newRecord: function(data, initRecord) {
    var record = this.buildRecord(data || {});
    record.id = Math.random();
    record.newRecord = true;

    if(initRecord !== false) {
      var keys = record.fields.keys;
      for(var i = 0, len = keys.length; i < len; i++){
        if(typeof record.data[keys[i]] == "undefined") {
          record.data[keys[i]] = "";
        }
      }
    }

    return record;
  },

  /*
   * Delete existing Records
   *
   */
  hideRecord: function(record) {
    this.updateAttribute({
      record: record,
      field: 'hidden',
      value: true
    });
  },

  deleteRecord: function(record, cb, scope){
    this.deleteRecordById(record.id, cb, scope);
  },
  deleteRecordById: function(id, cb, scope){
    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record to delete
    if (this.controller.isReadOnly()) {
      SWorks.Messages.alert('readonly');
      return;
    }

    if(this.restUrl) {
      Ext.Ajax.jsonRequest({
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
  onDeleteById: function(result, options, response) {
    var id = options.deleting_id;

    if (result.success) {
      if(options.cb.fn) {
        options.cb.fn.call(options.cb.scope);
      }
      this.fireEvent('delete', id);
    } else {
      SWorks.ErrorHandling.serverError(response, result);
    }
  },

  linkToParent: function(parent, parentForm) {
    this.parentController = parent;
    this.parentForm = parentForm;
  }
});

SWorks.StoreDataModel = function(overrides) {
  var store = overrides.store;

  Ext.apply(this, {
    store: store,
    createUrl: store.url,
    restUrl: store.url + '/{0}',
    parameterTemplate: store.model + "[{0}]",
    recordType: store.recordType
  });

  SWorks.StoreDataModel.superclass.constructor.call(this, overrides);

  this.checkForeignKey();
};
Ext.extend(SWorks.StoreDataModel, SWorks.DataModel, {
  buildRecord: function(data, id) {
    var record = SWorks.StoreDataModel.superclass.buildRecord.apply(this, arguments);
    record.data = record.data || {};
    record.data.klass = record.data.klass || this.store.klass;

    return record;
  },
  reload: function() {
    this.store.reload();
  },
  newRecord: function(data, initRecord) {
    var record = SWorks.StoreDataModel.superclass.newRecord.apply(this, arguments);
    if (this.store) {
      record.data.klass = record.data.klass || this.store.klass;
    }

    return record;
  },
  updateRecord: function(record, result) {
    SWorks.StoreDataModel.superclass.updateRecord.call(this, record, result);
    if(record.newBeforeSave && !record.store &&
      record.constructor == this.store.recordType) {
      this.store.addSorted(record);
    }
  },
  onDeleteById: function(result, options) {
    SWorks.StoreDataModel.superclass.onDeleteById.apply(this, arguments);
    if(result.success) {
      var id = options.deleting_id;
      var record = this.store.getById(id);
      if(record) {
        this.store.remove(record);
      }
    }
  },

  loadFromRecord: function(record) {
    this.loadedFromRecord = record;
    this.onLoadFromRecord(record);
  },

  onLoadFromRecord: function(record) {
    this.store.whenLoaded(function() {
      this.store.addFilter(this.recordFilter, this);
    }, this);
  },

  linkToParent: function(parent, parentForm) {
    SWorks.StoreDataModel.superclass.linkToParent.apply(this, arguments);

    if (this.foreignKey) {
      parent.on('load', this.onParentLoaded, this);
    }
  },
  onParentLoaded: function(form, record) {
    if(form == this.parentForm) {
      this.currentParentRecord = record;
      this.loadFromRecord(record);
    }
  },

  checkForeignKey: function() {
    if(this.foreignKey) {
      var column = this.foreignKey.replace(/id/, "type");
      var value = (this.recordType.prototype.fields.keys.indexOf(column) != -1);

      if(value) {
        this.foreignTypeKey = column;
      }
    }
  },

  recordFilter: function(record) {
    var r = this.loadedFromRecord,
        typeMatch = true,
        idMatch = (record.data[this.foreignKey] == r.id);

    //Provides automatic filtering on polymophic relations
    if(this.foreignTypeKey) {
      typeMatch = (record.data[this.foreignTypeKey] == r.getKlass());
    }

    return (idMatch && typeMatch);
  },

  onCustomFilter: function(enabled, filter) {
    if (enabled) {
      this.store.addFilter(filter.filter);
    } else {
      this.store.removeFilter(filter.filter);
    }
  }
});

SWorks.URLLoadingDataModel = function(overrides) {
  var store = overrides.store;

  if(store.mirrorSource) {
    console.error("URL loading can't use cloned/mirrored stores. Bad things will happen");
  }

  SWorks.URLLoadingDataModel.superclass.constructor.call(this, overrides);
};
Ext.extend(SWorks.URLLoadingDataModel, SWorks.StoreDataModel, {
  parentKey: 'id',

  reload: function() {
    if(this.loadedFromRecord && 
       this.loadedFromRecord.newRecord) {
      this.store.removeAll();
    } else {
      this.store.reload();
    }
  },

  onLoadFromRecord: function(record) {
    this.store.on('beforeload', this.setLoadParameters, this);

    this.store.load();
  },

  setLoadParameters: function(store, options) {
    var record = this.loadedFromRecord;

    if(!record || !record.data[this.parentKey]) {
      // Loads an empty dataset and fires the load event
      this.store.loadRecords({
        records: [],
        totalRecords: 0 }, options);
      return false;
    } else if(this.store.constructor == SWorks.SearchStore) {
      return this.loadSearchStoreFromRecord(record);
    } else {
      return this.loadStandardStoreFromRecord(record);
    }
  },

  loadStandardStoreFromRecord: function(record) {
    var r = record, s = this.store, url = s.baseUrl;
    if(!url && this.foreignKey) {
      url = s.url + '?' + this.foreignKey + '={0}';
      if(this.foreignTypeKey) {
        url = url + '&' + this.foreignTypeKey + '={1}';
      }
    }

    if(url) {
      // putting this in the options doesn't make it durable enough
      s.proxy.conn.url = String.format(url, r.data[this.parentKey], r.getKlass());
    } else {
      console.error("This store doesn't have a url");
      return false;
    }
  },

  loadSearchStoreFromRecord: function(record) {
    this.store.addFilter('data_model_fk', this.foreignKey+':'+record.data[this.parentKey]);
    if (this.foreignTypeKey) {
      this.store.addFilter('data_model_polymorphic', this.foreignTypeKey+':'+record.getKlass());
    }
  }
});

SWorks.FerretSearchDataModel = function(overrides) {
  SWorks.FerretSearchDataModel.superclass.constructor.apply(this, arguments);

  this.store.baseParams = this.store.baseParams || {};
  this.store.baseParams.limit = this.pageSize;
};
Ext.extend(SWorks.FerretSearchDataModel, SWorks.StoreDataModel, {
  updateRecord: function(record, result) {
    // We don't want the normal StoreDataModel behavior, which is to add the
    // record to our store if it is new. New records with ferret models are
    // for the form only and shouldn't be put in the store, we'll make special
    // ferret records for our store (which backs the grid). So go to
    // StoreDataModel's superclass (DataModel). The standard behavior of removing
    // hidden records works fine with our ferret records, that way they get
    // removed when the record is actually hidden, and it set's the record id
    // on the form records and manages newRecord and newBeforeSave for us
    SWorks.StoreDataModel.superclass.updateRecord.call(this, record, result);

    if (result.ferret_data) {
      // if we got ferret_data back, find or create a ferret record and update
      // its attributes
      var myrecord = this.store.getById(result.objectid) ||
                     new this.store.recordType(result.ferret_data, result.objectid);

      myrecord.setAttributes(result.ferret_data);
      myrecord.commit();
      if (!myrecord.store) {
        this.store.add(myrecord);
      }
    } else {
      this.store.reload();
    }
  },
  onCustomFilter: function(enabled, filter) {
    if (enabled) {
      this.store.addFilter(filter.text, (filter.query || filter.getQuery.call(this)));
    } else {
      this.store.removeFilter(filter.text);
    }

    this.store.load();
  }
});

SWorks.InlineEditorDataModel = function(overrides) {
  SWorks.InlineEditorDataModel.superclass.constructor.apply(this, arguments);

  // Disable reloading
  this.store.refreshPeriod = 0;
  this.store.cancelRefreshTask();
}
Ext.extend(SWorks.InlineEditorDataModel, SWorks.URLLoadingDataModel, {
  updateRecord: function(record, result) {
    SWorks.InlineEditorDataModel.superclass.updateRecord.apply(this, arguments);

    // When we inline edit, we have to insert the record before
    // it has it's permenant id. So when we save it we have to
    // remove it and put it back it with it's correct id because
    // the store can't deal with records whose id changes.
    if (record.newBeforeSave) {
      var found = this.store.getById(record.id);
      if (!found) {
        this.store.remove(record);
        this.store.addSorted(record);
      }
    }
  }
});
