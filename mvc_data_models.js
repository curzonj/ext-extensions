/*globals SWorks, Ext */

Ext.namespace('SWorks');

SWorks.DataModel = function(overrides) {
  Ext.apply(this, overrides);

  SWorks.DataModel.superclass.constructor.call(this);

  this.addEvents('beforeload', 'load', 'delete', 'save');
};
Ext.extend(SWorks.DataModel, Ext.util.Observable, {
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

    if(o.waitMsg !== false) {
      Ext.MessageBox.wait(o.waitMsg || "Updating Record...");
    }

    if(!o.url && o.record) {
      o = this.setUpdateOrCreate(o.record, o);
    } else {
      o.url = o.url || String.format(this.restUrl, rid);
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
  postToRecordCallback: function(result, options) {
    if(options.waitMsg !== false) {
      Ext.MessageBox.updateProgress(1);
      Ext.MessageBox.hide();
    }

    var record = options.record;
    if (result.success) {
      if(record) {
        if(record.store) {
          var reloaded_record = record.store.getById(record.id);
          if (reloaded_record) {
            record = reloaded_record;
          }
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

      SWorks.ErrorHandling.serverError(result);
    }
  },

  /*
   * Save from a form
   *
   */
  saveForm: function(form, o){
    o = o || {};

    // TODO, add readOnly safety check

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
    o.dataSentRecord = new this.recordType({});
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
  getParentRelation: function(form) {
    var values = {};

    if (this.controller && this.controller.parentForm) {
      var parentRecord = this.controller.parentForm.record;

      var idField = String.format(this.parameterTemplate, this.foreignKey);
      values[idField] = parentRecord.id;

      var typeColumn = this.foreignKey.replace(/id/, "type");
      if (this.recordType.prototype.fields.keys.indexOf(typeColumn) != -1) {
        var typeField = String.format(this.parameterTemplate, typeColumn);

        values[typeField] = parentRecord.getKlass();
      }
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
      form.fields[key];

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

      form.isDirty();
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
    if (action.failureType != 'server' && action.failureType != 'client') {
      SWorks.ErrorHandling.serverError(action.result);
    } else if (action.failureType == 'server' && action.result.errors.base) {
      Ext.MessageBox.alert('Save failed', action.result.errors.base);
    } else if (action.options.waitMsg !== false) {
      Ext.MessageBox.alert('Save failed',
        'Please fix all the boxes highlighted in red.');
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
  
      // By using edit, widgets can update the UI if a related record changes 
      record.json = result.data;
      record.beginEdit();
      for(var a in result.data) {
        var value = result.data[a];

        if(typeof value == 'object') {
          //record.set only takes non-objects
          record.data[a] = value;
        } else {
          record.set(a, value);
        }
      }
      record.endEdit();

      record.commit();
    }
  },

  /*
   * Load records
   *
   */
  loadData: function(data, id) {
    var r = new this.recordType(data, id);
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
  onFetchRecordResponse: function(result, options) {
    Ext.MessageBox.updateProgress(1);
    Ext.MessageBox.hide();

    if (result.success) {
      var record = new this.recordType(result.data, result.objectid);
      record.json = result.data;
      if(this.store) {
        // This doesn't add it to the store, just sets record.store = store
        record.join(this.store);
      }

      options.cb.fn.call(options.cb.scope || this, record);
    } else {
      SWorks.ErrorHandling.serverError(result);
    }
  },

  /*
   * Create new records
   *
   */
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
  onDeleteById: function(result, options) {
    var id = options.deleting_id;

    if (result.success) {
      if(options.cb.fn) {
        options.cb.fn.call(options.cb.scope);
      }
      this.fireEvent('delete', id);
    } else {
      SWorks.ErrorHandling.serverError(result);
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
  reload: function() {
    this.store.reload();
  },
  newRecord: function(data, initRecord) {
    var record = SWorks.StoreDataModel.superclass.newRecord.apply(this, arguments);
    if (record && this.store) {
      // This doesn't add it to the store, just sets record.store = store
      record.join(this.store);
    }

    return record;
  },
  updateRecord: function(record, result) {
    SWorks.StoreDataModel.superclass.updateRecord.call(this, record, result);
    if(record.newBeforeSave) {
      record.id = record.data.id = result.objectid;
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
    if(!record || !record.data[this.parentKey]) {
      this.store.removeAll();
    } else if(this.store.constructor == SWorks.SearchStore) {
      this.loadSearchStoreFromRecord(record);
    } else {
      this.loadStandardStoreFromRecord(record);
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

      s.load();
    } else {
      console.error("This store doesn't have a url");
    }
  },

  loadSearchStoreFromRecord: function(record) {
    this.store.addFilter('data_model_fk', this.foreignKey+':'+record.data[this.parentKey])
    if (this.foreignTypeKey) {
      this.store.addFilter('data_model_polymorphic', this.foreignTypeKey+':'+record.getKlass())
    }
    this.store.load();
  }
});
