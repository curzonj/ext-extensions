var CrudEditor = function(config) {
  /* Defined Interface:
   * createRecord() - create and load a new record
   * loadRecord(record) - load it in something to edit
   * deleteRecord(record) - delete the record
   */
  this.initialConfig = config;
  Ext.apply(this, config);

  this.addEvents({
    beforeaction: true,
    actionfailed: true,
    actioncomplete: true,

    beforeload: true,
    load: true,
  });

  if(this.store.loadIfNeeded)
    this.store.loadIfNeeded();

  CrudEditor.superclass.constructor.call(this, config);
}
Ext.extend(CrudEditor, Ext.util.Observable, {
  createParentRef: function(form) {
    var saveParent = this.saveForm.createDelegate(this, [form]);
    var listenerDelegate = this.on.createDelegate(this);

    return {
      form: form,
      store: this.store,
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
        } else if(this.editor && this.editor.setParent) {
          this.editor.setParent(pVal);
        }
      }
    });
  },
  setParent: function(p) {
    this.parent = p;

    if(this.parentIdColumn) {
      this.store.linkToParent(p, this.parentIdColumn);
    }
  },
  //callback: editor.eventHandler('disable', "Sorry, failed");
  eventHandler: function(evt, msg) {
    return this.sendEvent.createDelegate(this, [evt, msg], true);
  },
  sendEvent: function(record, eventName, failedMsg){
    // we don't have to worry about receiving unsaved records here

    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record
    //

    failedMsg = failedMsg || "Failed to update the record. Please try again.";

    var requestURL = this.eventUrl || (this.store.url + '/' + record.id);
    Ext.Ajax.request({
      url: requestURL,
      params: { event: eventName, '_method': 'put' },
      success: function(response) {
        var result =  Ext.decode(response.responseText);
        if (result.success) {
          this.updateRecord(record, result);
        } else {
          msg = result.msg || failedMsg;
          Ext.MessageBox.alert('Operation failed', msg);
          this.store.reload();                      
        }
      },
      failure: function() {
        Ext.MessageBox.alert('Operation failed', failedMsg);
      },
      scope: this
    });
  },
  createRecord: function(){
    //This doesn't load it into the dataStore because that should
    //reflect saved objects, this only exists in the form. The
    //record will be added into the dataStore if it is saved.
    var record = this.newRecord.apply(this, arguments);

    if(this.parent) {
      this.executeOnFormSaved(
        this.parent.form, this.parent.save,
        function() { this.loadRecord(record); },
        this, true);
    } else {
      this.loadRecord(record);
    }
  },
  newRecord: function() {
    var record = new this.store.reader.recordType();

    list = [record].concat(arguments);
    this.initializeRecord.apply(this, list);

    return record;
  },
  executeOnFormSaved: function(form, saveFn, fn, scope, allowDirty) {
    // allowDirty and scope are optional
    scope = scope || this;
    if(form.record.newRecord || (!allowDirty && form.isDirty())) {
      var failFn, loadFn = function() {
        form.un('actionfailed', failFn, null);
        fn.call(scope);
      }
      failFn = function() {
        form.un('actioncomplete', loadFn, null);
      }

      form.on('actioncomplete', loadFn, null, {single: true});
      form.on('actionfailed', failFn, null, {single: true});

      saveFn.call(scope);
    } else {
      fn.call(scope);
    }
  },
  initializeRecord: function(record){
    var keys = record.fields.keys;
    record.data = {};
    for(var i = 0, len = keys.length; i < len; i++){
      record.data[keys[i]] = "";
    }
    record.id = 'new';
    record.newRecord = true;
  },
  deleteRecord: function(record){
    // We only allow deletions from the data store and new records
    // are only ever in the form, so we don't have to worry about
    // receiving unsaved records here

    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record to delete

    var requestURL = this.deleteUrl || (this.store.url + '/' + record.id);
    Ext.Ajax.request({
      url: requestURL,
      method: "DELETE",
      success: function(response) {
        var result =  Ext.decode(response.responseText);
        if (result.success) {
          this.store.remove(record);
        } else {
          msg = result.msg || "Failed to delete the record. Please try again."
          Ext.MessageBox.alert('Delete failed', msg);
          this.store.reload();                      
        }
      },
      failure: function() {
        Ext.MessageBox.alert('Delete failed',
          "Failed to delete the record. Please try again.");
      },
      scope: this
    });
  },
  onRecordUpdate: function(store, record, type, form) {
    if(form.record &&
       form.record.id == record.id &&
       type == Ext.data.Record.EDIT) {
      form.setValues(record.getChanges());
    }
  },
  loadRecord: function(record) {},
  //the panel parameter is optional, it is up to the
  //implementation to pass it or not
  loadForm: function(form, record, panel){
    // TODO needs handle record locking
    form.record = record;

    if(this.fireEvent('beforeload', form, record, panel) !== false) {

      form.trackResetOnLoad = true;
      form.loadRecord(record);
      form.clearInvalid();

      this.fireEvent('load', form, record, panel);
    }
  },
  getParentRelAttrs: function(record) {
    var values = {}
    
    var idField = this.store.model + '[' + this.store.parentIdColumn + ']';
    values[idField] = this.parent.form.record.id

    if(this.store.hasParentType()) {
      var typeField = this.store.model + '[' + this.store.parentTypeColumn + ']';
      values[typeField] = this.parent.store.klass
    }

    return values
  },
  // the o is optional and is only for REALLY custom work
  saveForm: function(form, o){
    var record = form.record;

    // Prevents errors from holding the enter key
    // down too long or bouncing it
    if (form.submitLock)
      return;
    form.submitLock = true;

/*    if (!form.isValid()) {
      if(o.waitMsg !== null) {
        Ext.MessageBox.alert('Save failed',
          'Please fill in all the required boxes highlighted in red.');
      }
      form.submitLock = false;
      return;
    } */

    o = o || {};
    o.params = o.params || {};
    
    var requestURL = null;
    if(record.newRecord) {
      requestURL = this.createUrl || this.store.url;
      o.params['_method'] = 'post';
    } else {
      requestURL = this.updateUrl || (this.store.url + '/' + record.id);
      o.params['_method'] = 'put';
    }

    if(this.parent) {
      Ext.applyIf(o.params, this.getParentRelAttrs(record));
    }

    this.dealWithEmptyCombos(form);

    form.submit(Ext.applyIf(o ,{
      url: requestURL,
      waitMsg: "Saving record...",
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
  hideRecord: function(record) {
    this.updateAnyAttribute({
      record: record,
      field: 'hidden',
      value: true,
    });
  },
  updateAnyAttribute: function(options) {
    /* options:
     *   store: store of the model you want to update
     *   id: id of the record you want to update
     *   field: the model attribute to update
     *   value: the new value
     *   success: the callback if it succeeds
     *   failure: callbark on failure
     *   scope: obvious
     */
     Ext.applyIf(options, {
       id: ( options.record ? options.record.id : null ),
       store: this.store,
       scope: this
     });

     Ext.MessageBox.wait(options.waitMsg || "Updating ...");

     Ext.applyIf(options, {
        url: (options.store.url + '/' + options.id),
        params: {},
        callback: function(options, success, response) {
          Ext.MessageBox.updateProgress(1);
          Ext.MessageBox.hide();

          if(success) {
            var result =  Ext.decode(response.responseText);
            if (result.success) {
              var record = options.store.getById(options.id);
              this.updateRecord(record, result);
              if(options.successFn)
                options.successFn.call(options.scope);
            } else {
              if(options.failureFn)
                options.failureFn.call(options.scope);
            }
          } else {
            if(options.failureFn)
              options.failureFn.call(options.scope);
          }
        },
        scope: this 
     });
    
     options.successFn = options.success
     options.failureFn = options.failure
     delete options.success
     delete options.failure

     options.params['_method'] = 'put';
     
     if(options.field && options.value)
       options.params[options.store.model+'['+options.field+']'] =  options.value;

     Ext.Ajax.request(options); 
  },
  formSuccess: function(form, action) {

    if(action.result) { //should never be false, but who knows
      // Reload our record because it might be too old
      var record = form.record
      if(!record.newRecord) {
        record = form.record =
          this.store.getById(action.result.objectid);
      }

      this.processRecords(action.result);
      this.updateRecord(record, action.result);
    }

    form.submitLock = false;
  },
  formFailure: function(form, action) {

    if (action.failureType == 'client' && action.options.waitMsg) {
      Ext.MessageBox.alert('Save failed',
        'Please fill in all the required boxes highlighted in red.');
    } else if (action.failureType != 'client' &&
        (!action.result || !action.result.errors)) {
      this.store.reload(); // get back to a know state
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
      if ( !record.newRecord && this.store.getById(record.id) ) 
        this.store.remove(record);
    } else {
      if(record.newRecord) {
        record.newRecord = false;

        this.store.add(record);
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

var DialogCrudEditor = function(config) {
  DialogCrudEditor.superclass.constructor.call(this, config);

  if(!this.dialog || !this.dialog.doLayout) {
    this.createWindow();
  }

  this.form = this.formPanel.form;

  this.recordUpdateDelegate = this.onRecordUpdate.createDelegate(this, [this.form], true);
  this.store.on('update', this.recordUpdateDelegate);

  this.relayEvents(this.form, ['beforeaction', 'actionfailed', 'actioncomplete']);

  this.findChildren(this.dialog, this.form);
}
Ext.extend(DialogCrudEditor, CrudEditor, {
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
     this.form.record = record = this.store.getById(record.id);
    }
    return record;
  },*/
  createWindow: function(config) {

    config = this.initialConfig;
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
    if(typeof trigger == 'object' || e.target.type != 'button')
      this.dialog.hide();
  }
});


var TabbedCrudEditor = function(config) {
  TabbedCrudEditor.superclass.constructor.call(this, config);

  this.tabPanel.autoDestroy = true;
  this.tabPanel.on('beforeremove', this.onBeforeRemove, this);

  this.panels = {};
  this.cachedEditPanel = this.createEditPanel();
}
Ext.extend(TabbedCrudEditor, CrudEditor, {
  autoSaveInterval: 2000,
  maxAttempts: 3,

  onBeforeRemove: function(ct, panel) {
    if(panel.form && !panel.form.bypassSaveOnClose && panel.form.isDirty()) {
      var closePanelFn = function() {
        panel.form.bypassSaveOnClose = true;
        ct.remove(panel);  
      }

      Ext.MessageBox.confirm("Save changes", "Do you want to save your changes?", function(btn) {
        // Often the data gets saved while the person choses
        if(btn == "yes") {
          this.executeOnFormSaved(
            panel.form,
            function() { this.saveForm(panel.form); },
            closePanelFn
          );
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

    var panel = this.cachedEditPanel || this.createEditPanel();
    this.cachedEditPanel = null;

    this.loadForm(panel.form, record, panel);
    this.panels[record.id] = panel;

    this.tabPanel.add(panel);
    this.tabPanel.setActiveTab(panel);
    panel.doLayout();

    var editor = this;
    setTimeout(function(){
      editor.cachedEditPanel = editor.createEditPanel()
    }, 2);
  },
  getPanel: Ext.emptyFn,
  createEditPanel: function() {
    var panel = this.getPanel();
    Ext.apply(panel, {
      closable: true,
      autoRender: true,
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
        this.saveForm(panel.form, { waitMsg: null });
      }
    }, this);
    panel.on('destroy', function() {
      this.store.un('update', recordUpdateDelegate);

      if(panel.autoSaveTask)
        panel.autoSaveTask.cancel();
    }, this);

    var startTimer = function() {
      panel.autoSaveTask.delay(this.autoSaveInterval);
    }

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

      form.autoSaveAttempts = form.autoSaveAttempts || 1
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
