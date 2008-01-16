/*globals Ext, SWorks */

SWorks.CrudEditor = function(config) {
  /* Defined Interface:
   * createRecord() - create and load a new record
   * loadRecord(record) - load it in something to edit
   * deleteRecord(record) - delete the record
   */
  this.initialConfig = config;
  Ext.apply(this, config);

  this.addEvents([
    'beforeaction',
    'actionfailed',
    'actioncomplete',
    'beforeload',
    'load',
    'delete',
    'save'
  ]);

  SWorks.CrudEditor.superclass.constructor.call(this, config);
};
Ext.extend(SWorks.CrudEditor, Ext.util.Observable, {
  parameterTemplate: "{0}",

  /*
   * Parent relation management
   * 
   */
  createParentRef: function(form) {
    var saveParent = this.saveForm.createDelegate(this, [form]);
    var listenerDelegate = this.on.createDelegate(this);

    return {
      form: form,
      daoClass: this.daoClass,
      save: saveParent,
      on: listenerDelegate
    };
  },
  findChildren: function(panel, form) {
    var pVal = this.createParentRef(form);
    panel.cascade(function() {
      if(this != panel) {
        if(this.setParent) {
          this.setParent(pVal);
        } else {
          return true;
        }
        //Find the first item that will receive a parent
        //on each branch and then stop.
        return false;
      }
    });
  },
  setParent: function(p) {
    this.parent = p;
  },
  executeOnFormSaved: function(form, saveFn, fn, scope, allowDirty) {
    // allowDirty and scope are optional
    scope = scope || this;
    if(form.record.newRecord || (!allowDirty && form.isDirty())) {
      var failFn, loadFn = function() {
        form.un('actionfailed', failFn, null);
        fn.call(scope);
      };
      failFn = function() {
        form.un('actioncomplete', loadFn, null);
      };

      form.on('actioncomplete', loadFn, null, {single: true});
      form.on('actionfailed', failFn, null, {single: true});

      saveFn.call(scope);
    } else {
      fn.call(scope);
    }
  },
  getParentRelAttrs: function(record) {
    var values = {};
    
    var typeColumn = this.parentIdColumn.replace(/id/, "type");
    var idField = String.format(this.parameterTemplate, this.parentIdColumn);
    values[idField] = this.parent.form.record.id;

    if (this.recordType.prototype.fields.keys.indexOf(typeColumn) != -1) {
      var typeField = String.format(this.parameterTemplate, typeColumn);
      values[typeField] = this.parent.daoClass;
    }

    return values;
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

     options.params._method = 'put';

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
    var data = record.data;
    var fields = this.serializedFields || record.fields.keys;
    for(var i=0;i<fields.length;i++) {
      var key = String.format(this.parameterTemplate, fields[i]);
      var value = data[fields[i]];
      if(typeof value != "undefined") {
        values[key] = value;
      }
    }

    return values;
  },
  postToRecord: function(rid, o) {
    if(o.waitMsg !== false) {
      Ext.MessageBox.wait(o.waitMsg || "Updating Record...");
    }

    // TODO add a retry mechanism

    if(o.record) {
      o = this.setUpdateOrCreate(o.record, o);
    } else {
      o.url = o.url || String.format(this.restUrl, rid);
    }

    o.errmsg = o.errmsg || "Failed create update the record. Please try again.";
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

    if (success && result.success) {
      var record = options.record;

      if(record) {
        if(record.store) {
          record = record.store.getById(record.id);
        }
        this.updateRecord(record, result);
      } else {
        record = new this.recordType(result.data, result.objectid);
      }
     
      if(options.cb.fn) { 
        options.cb.fn.call(options.cb.scope || this, record, result);
      }
      this.fireEvent('save', record, result);
      record.newBeforeSave = false;
    } else {
      var msg = ((result && result.errors) ? (result.errors.base || options.errmsg) : options.errmsg);
      Ext.MessageBox.alert('Operation failed', msg);
    }
  },

  /*
   * Save from a form
   *
   */
  saveForm: function(form, o){
    // Prevents errors from holding the enter key
    // down too long or bouncing it
    if (form.submitLock) {
      return;
    }
    form.submitLock = true;

    var record = form.record;
    o = this.setUpdateOrCreate(record, o);

    if(this.parent) {
      Ext.applyIf(o.params, this.getParentRelAttrs(record));
    }

    form.submit(Ext.applyIf(o ,{
      waitMsg: "Saving record...",
      success: this.formSuccess,
      failure: this.formFailure,
      scope: this
    }));
  },
  formSuccess: function(form, action) {
    if(action.result) { //should never be false, but who knows
      // Reload our record because it might be too old
      var record = form.record;
      if(!record.newRecord && record.store) {
        record = form.record =
          record.store.getById(action.result.objectid);
      }

      this.updateRecord(record, action.result);
      this.fireEvent('save', form.record, action.result);
      form.record.newBeforeSave = false;
    }

    form.submitLock = false;
  },
  formFailure: function(form, action) {

    if (action.failureType == 'client' && action.options.waitMsg) {
      Ext.MessageBox.alert('Save failed',
        'Please fill in all the required boxes highlighted in red.');
    } else if (action.failureType != 'client' &&
        (!action.result || !action.result.errors)) {
      Ext.MessageBox.alert('Save failed',
        'Failed to save the record. Please try again.');
    } else if (action.result && action.result.errors &&
        action.result.errors.base) {
      Ext.MessageBox.alert('Save failed', action.result.errors.base);
    }
    // else, Ext will display our validation errors from JsonController.
    // Read http://extjs.com/deploy/ext/docs/output/Ext.form.TextField.html#config-msgTarget
    // for more information about your options for styling error messages.
    // We should however keep the styling consistant across all our modules
    
    form.submitLock = false;
  },
  updateRecord: function(record, result) {
    // You need to pass in your own upto date record, (formSuccess does)
    record.id = result.objectid;

    if( result.hidden ) {
      if ( !record.newRecord &&
           record.store &&
           record.store.getById(record.id) )  {
        record.store.remove(record);
      }
    } else {
      if(record.newRecord) {
        record.newRecord = false;
        record.newBeforeSave = true;
      }
   
      // We use the edit mechnism on new records to deal with
      // forms that may save a new record without closing; they
      // need to get updates about any fields the server changed
      // on them.
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
  loadRecord: function(record) {},
  loadForm: function(form, record, panel){
    //the panel parameter is optional, it is up to the
    //implementation to pass it or not
    // TODO needs handle record locking
    form.record = record;

    if(this.fireEvent('beforeload', form, record, panel) !== false) {

      this.onFormLoad(form, record, panel);
      this.fireEvent('load', form, record, panel);

      return true;
    } else {
      return false;
    }
  },
  onFormLoad: function(form, record, panel) {
    form.trackResetOnLoad = true;
    form.loadRecord(record);
    form.clearInvalid();
  },
  fetchRecord: function(id, o) {
    o.cb = {
      fn: o.callback,
      scope: o.scope
    };
    o.errmsg = o.errmsg || "Failed to load the record. Please try again.";

    Ext.MessageBox.wait("Loading Record...");

    Ext.Ajax.request(Ext.apply(o, {
      url: String.format(this.restUrl, id),
      callback: function(options, success, response) {
        Ext.MessageBox.updateProgress(1);
        Ext.MessageBox.hide();

        var result = null;
        if(success) {
          result =  Ext.decode(response.responseText);
        }

        if (success && result.id == id) {
          var record = new this.recordType(result, id);

          options.cb.fn.call(options.cb.scope || this, record);
        } else {
          var msg = (result ? (result.error || options.errmsg) : options.errmsg);
          Ext.MessageBox.alert('Load record failed', msg);
        }
      },
      scope: this
    }));
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

      this.initializeRecord(record);
    }

    return record;
  },
  createRecord: function(){
    //This doesn't load it into the dataStore because that should
    //reflect saved objects, this only exists in the form. The
    //record will be added into the dataStore if it is saved.
    var args = arguments;
    var fn = function() {
      var record = this.newRecord.apply(this, args);
      this.loadRecord(record);
    };

    if(this.parent && this.parent.form) {
      this.executeOnFormSaved(
        this.parent.form, this.parent.save,
        fn.createDelegate(this),
        this, true);
    } else {
      fn.call(this);
    }
  },
  initializeRecord: function(record) {},

  /*
   * Delete existing Records
   *
   */
  deleteRecord: function(record){
    this.deleteRecordById(record.id);
  },
  deleteRecordById: function(id){
    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record to delete
    if(this.restUrl) {
      Ext.Ajax.request({
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
      this.fireEvent('delete', id);
    } else {
      var msg = (result && result.msg ? result.msg : "Failed to delete the record. Please try again.");
      Ext.MessageBox.alert('Delete failed', msg);
    }

    return result;
  }
});

SWorks.ManagedCrudEditor = function(config) {
  /*
   * This extracts everything that depends on a store
   * is is wacky.
   */
  SWorks.ManagedCrudEditor.superclass.constructor.call(this, config);

  this.createUrl = this.store.url;
  this.restUrl = this.store.url + '/{0}';
  this.parameterTemplate = this.store.model + "[{0}]";
  this.daoClass = this.store.klass;
  this.recordType = this.store.recordType;
};
Ext.extend(SWorks.ManagedCrudEditor, SWorks.CrudEditor, {
  eventHandler: function(evt, msg) {
    //example = callback: editor.eventHandler('disable', "Sorry, failed");
    return this.sendEvent.createDelegate(this, [evt, msg], true);
  },
  sendEvent: function(record, eventName, failedMsg){
    this.postToRecord(record.id, {
      errmsg: failedMsg,
      record: record,
      params: {
        'event': eventName,
        '_method': 'put'
      }
    });
  },
  createParentRef: function(form) {
    var result = SWorks.ManagedCrudEditor.superclass.createParentRef.call(this, form);
    result.store = this.store;

    return result;
  },
  onDeleteById: function(options, success, response) {
    var result = SWorks.ManagedCrudEditor.superclass.onDeleteById.apply(this, arguments);
    if(success && result.success) {
      var id = options.deleting_id;
      var record = this.store.getById(id);
      if(record) {
        this.store.remove(record);
      }
    }

    return result;
  },
  onRecordUpdate: function(store, record, type, form) {
    if(form.record &&
       form.record.id == record.id &&
       type == Ext.data.Record.EDIT) {
      form.setValues(record.getChanges());
    }
  },
  saveForm: function(form, o) {
    this.dealWithEmptyCombos(form);

    SWorks.ManagedCrudEditor.superclass.saveForm.call(this, form, o);
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
  formFailure: function(form, action) {
    SWorks.ManagedCrudEditor.superclass.formFailure.call(this, form, action);
    if (action.failureType != 'client' &&
        (!action.result || !action.result.errors)) {
      this.store.reload(); // get back to a know state
    }
  },
  updateRecord: function(record, result) {
    if(record.newRecord) {
      record.id = result.objectid;
      this.store.add(record);
    }
    SWorks.ManagedCrudEditor.superclass.updateRecord.call(this, record, result);
  },
  hideRecord: function(record) {
    this.updateAttribute({
      record: record,
      field: 'hidden',
      value: true
    });
  },
  processRecords: function(data) {
    if(data.records) {
      for(var i=0;i<data.records.length;i++) {
        var r = data.records[i], record = null;
        var store = Ext.StoreMgr.get(r.klass || r.model);
        if(store && r.id) {
          record = store.getById(r.id);
          if(!record) {
            record = new store.reader.recordType();
            record.newRecord = true;
          }
          this.updateRecord(record, r);
        }
      }
    }
  }
});

SWorks.DialogCrudEditor = function(config) {
  SWorks.DialogCrudEditor.superclass.constructor.call(this, config);

  if(!this.dialog || !this.dialog.doLayout) {
    this.createWindow();
  }

  this.form = this.formPanel.form;

  this.recordUpdateDelegate = this.onRecordUpdate.createDelegate(this, [this.form], true);
  this.store.on('update', this.recordUpdateDelegate);

  this.relayEvents(this.form, ['beforeaction', 'actionfailed', 'actioncomplete']);

  this.findChildren(this.dialog, this.form);
};
Ext.extend(SWorks.DialogCrudEditor, SWorks.ManagedCrudEditor, {
  loadRecord: function(record) {
    if(!this.dialog.rendered) {
      this.dialog.render(Ext.getBody());
    }

    this.on('load', function() {
      this.dialog.show();
    }, this, {single:true});
    this.loadForm(this.form, record);
  },
  /* This is good functionality, what do we do with it?
  getRecord: function() {
    var record = this.form.record;

    if(!record)
      return;
    
    if(!record.newRecord) {
      // Sometimes our store gets reloaded in between
      // and we throw errors if we use old records
     this.form.record = record = record.store.getById(record.id);
    }
    return record;
  },*/
  createWindow: function() {
    var config = this.initialConfig;
    Ext.applyIf(config, {
      width: 500,
      height: 300,
      autoCreate: true,
      modal: true,
      closable: false,
      resizable: true,
      draggable: true,
      collapsible: false,
      defaults: { border: false },
      title: ('Edit: '+config.store.klass),
      layout: 'fit',
      buttons: [{
        text: "Save",
        handler: this.onClickSave,
        scope: this
      }, {
        text: "Close",
        handler: this.onClickClose,
        scope: this
      }],
      keys: [
        { key: 27, fn: this.onClickClose, scope: this },
        { key: Ext.EventObject.ENTER, fn: this.onClickSave, scope: this }
      ]
    });

    this.dialog = new Ext.Window(config);

    this.formPanel = this.dialog.findByType('form')[0];
    this.formPanel.border = false;
    this.formPanel.bodyStyle = "padding:10px";

    this.dialog.on('show', function(){ this.dialog.keyMap.enable(); }, this);
    // TODO focus is broken all over
    //this.on('show', function(){ this.form.items.item(0).focus() }, this);
    //
    // TODO disable the save button unless dirty and
    // warn about leaving w/o saving
  },
  // TODO onRender, resize to component's size
  onClickSave: function(trigger, e) {
      //Only function as a button handler on buttons, this makes
      //sure ENTER still works on other buttons and textareas
      var list = [ 'button', 'textarea' ];
      if(typeof trigger == 'object' || list.indexOf(e.target.type) == -1) {
        this.dialog.keyMap.disable();
        this.form.on('actioncomplete', function() {
          this.dialog.hide();
        }, this, {single: true});
        this.form.on('actionfailed', function() {
          this.dialog.keyMap.enable();
        }, this, {single: true});
        this.saveForm(this.form);
      }
  },
  onClickClose: function(trigger, e) {
    //Only function as a button handler on buttons, this makes
    //sure ENTER still works on other buttons
    if(typeof trigger == 'object' || e.target.type != 'button') {
      this.dialog.hide();
    }
  }
});


SWorks.TabbedCrudEditor = function(config) {
  SWorks.TabbedCrudEditor.superclass.constructor.call(this, config);

  this.tabPanel.autoDestroy = true;
  this.tabPanel.on('beforeremove', this.onBeforeRemove, this);

  this.panels = {};
  this.cachedEditPanel = this.createEditPanel();
};
Ext.extend(SWorks.TabbedCrudEditor, SWorks.ManagedCrudEditor, {
  autoSaveInterval: 2000,
  maxAttempts: 3,

  onBeforeRemove: function(ct, panel) {
    if(panel.form && !panel.form.bypassSaveOnClose && panel.form.isDirty()) {
      var closePanelFn = function() {
        panel.form.bypassSaveOnClose = true;
        ct.remove(panel);  
      };

      Ext.MessageBox.confirm("Save changes", "Do you want to save your changes?", function(btn) {
        // Often the data gets saved while the person choses
        if(btn == "yes") {
          this.executeOnFormSaved( panel.form,
            function() { this.saveForm(panel.form); }, closePanelFn);
        } else {
          closePanelFn.call();
        }
      }, this);


      return false;
    } else {
      return true;
    }
  },
  loadRecord: function(record){
    var panel = this.panels[record.id];
    if(panel) {
      if(this.tabPanel.findById(panel.id) ) {
        this.tabPanel.setActiveTab(this.panels[record.id]);
        return;
      } else {
        delete this.panels[record.id];
      }
    } 

    panel = this.cachedEditPanel || this.createEditPanel();
    this.cachedEditPanel = null;

    this.loadForm(panel.form, record, panel);
    this.panels[record.id] = panel;

    this.tabPanel.add(panel);
    this.tabPanel.setActiveTab(panel);
    panel.doLayout();

    var editor = this;
    setTimeout(function(){
      editor.cachedEditPanel = editor.createEditPanel();
    }, 2);
  },
  getPanel: Ext.emptyFn,
  createEditPanel: function() {
    var panel = this.getPanel();
    Ext.apply(panel, {
      closable: true,
      autoRender: true
    });

    if(!panel.doLayout) {
      panel = new Ext.Panel(panel);
    }

    var formPanel = panel.findByType('form')[0];
    if (panel != formPanel) {
      panel.form = formPanel.form;
    }

    this.relayEvents(panel.form, ['beforeaction', 'actionfailed', 'actioncomplete']);
    this.findChildren(panel, panel.form);

    var recordUpdateDelegate = this.onRecordUpdate.createDelegate(this, [panel.form], true);
    this.store.on('update', recordUpdateDelegate);

    panel.autoSaveTask = new Ext.util.DelayedTask(function() {
      // Make sure we still exist and need to be saved
      if( panel.form &&
          panel.form.el &&
          panel.form.isDirty()) {
        this.saveForm(panel.form, { waitMsg: false });
      }
    }, this);
    panel.on('destroy', function() {
      this.store.un('update', recordUpdateDelegate);

      if(panel.autoSaveTask) {
        panel.autoSaveTask.cancel();
      }
    }, this);

    var startTimer = function() {
      panel.autoSaveTask.delay(this.autoSaveInterval);
    };

    panel.form.items.on('add', function(ct, cp) {
      cp.on('change', startTimer, this);
    }, this);
    panel.form.items.on('remove', function(ct, cp) {
      cp.un('change', startTimer, this);
    }, this);
    panel.form.on('actioncomplete', function() {
      this.autoSaveAttempts = 0;
    }, panel.form);

    panel.hidden = true;
//    panel.render(this.tabPanel.getLayoutTarget());
    panel.render(Ext.getBody());
    panel.doLayout();

    return panel;
  },
  formFailure: function(form, action) {
    form.submitLock = false;

    if (action.failureType == 'client' && action.options.waitMsg) {
      Ext.MessageBox.alert('Save failed',
        'Please fill in all the required boxes highlighted in red.');
    } else if (action.failureType != 'client' &&
        (!action.result || !action.result.errors)) {

      form.autoSaveAttempts = form.autoSaveAttempts || 1;
      if(form.autoSaveAttempts < this.maxAttempts) {
        form.autoSaveAttempts = form.autoSaveAttempts + 1;
        this.saveForm(form, action.options);
      } else {
        Ext.MessageBox.alert('Save failed',
        'Failed to save the record. Please try again.');
      }
    } else if (action.result && action.result.errors &&
        action.result.errors.base) {
      Ext.MessageBox.alert('Save failed', action.result.errors.base);
    }
    // else, Ext will display our validation errors from JsonController.
    // Read http://extjs.com/deploy/ext/docs/output/Ext.form.TextField.html#config-msgTarget
    // for more information about your options for styling error messages.
    // We should however keep the styling consistant across all our modules
  }
});
