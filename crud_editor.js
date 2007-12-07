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

  if(this.store.proxy && !this.store.proxy.activeRequest)
    this.store.load();

  CrudEditor.superclass.constructor.call(this, config);
}
Ext.extend(CrudEditor, Ext.util.Observable, {
  findChildren: function(panel, form) {
    var editor = this;
    var saveParent = function() {
      editor.saveForm(this.form);
    }
    var listenerDelegate = this.on.createDelegate(this);

    panel.cascade(function() {
      if(this != panel && this.editor && this.editor.setParent)
        this.editor.setParent({
          form: form,
          store: editor.store,
          save: saveParent,
          on: listenerDelegate
        });
    });
  },
  setParent: function(p) {
    this.parent = p;

    if(this.parentIdColumn) {
      this.store.linkToParent(p, this.parentIdColumn);
    }
  },
  //Append arguments via createDelegate
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
          this.updateRecordAfterTxn(record, result);
        } else {
          msg = result.msg || failedMsg;
          Ext.MessageBox.alert('Operation failed', msg);
          this.store.load();                      
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
    var record = new this.store.reader.recordType();
    this.initializeRecord(record);

    if(this.parent && this.parent.form.record.newRecord) {
      this.parent.form.on('actioncomplete', function() {
        //All we need is for parent.record.id to be valid
        //when we save. The only reason we wait to load the
        //record until the parent is saved is that will show
        //the window and we don't want that unless the parent
        //was successfull
        this.loadRecord(record);
      }, this, {single:true});
      this.parent.save();
    } else {
      this.loadRecord(record);
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
          this.store.load();                      
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
  loadForm: function(form, record){
    // TODO needs handle record locking
    form.record = record;

    if(this.fireEvent('beforeload', form, record) !== false) {

      form.trackResetOnLoad = true;
      form.loadRecord(record);
      form.clearInvalid();

      this.fireEvent('load', form, record);

      return true;
    } else {
      return false;
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

    // see ext-all-debug line 23816. It calls isValid for us
    
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
      Ext.applyIf(o.params, this.getParentRelAttrs());
    }

    form.submit(Ext.applyIf(o ,{
      url: requestURL,
      waitMsg: "Saving record...",
      success: this.formSuccess,
      failure: this.formFailure,
      scope: this
    }));
  },
  formSuccess: function(form, action) {
    form.submitLock = false;

    if(action.result) { //should never be false, but who knows
      // Reload our record because it might be too old
      var record = form.record
      if(!record.newRecord) {
        record = form.record =
          this.store.getById(action.result.objectid);
      }

      this.updateRecordAfterTxn(record, action.result);
    }
  },
  formFailure: function(form, action) {
    form.submitLock = false;

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
  },
  updateRecordAfterTxn: function(record, result) {
    record.id = result.objectid;

    if( result.hidden ) {
      if ( !record.newRecord && this.store.getById(record.id) ) 
        this.store.remove(record);
    } else {
      if(record.newRecord) {
        record.newRecord = false;
        this.store.add(record);
      }
    
      record.beginEdit();
      for(a in result.data) {
        record.set(a, result.data[a]);
      }
      record.endEdit();

      record.commit();
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

    if(this.loadForm(this.form, record)) {
      this.dialog.show();
    }
  },
  // TODO Should this be more generic?
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
  },
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
      title: 'Edit',
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
      //sure ENTER still works on other buttons
      if(typeof trigger == 'object' || e.target.type != 'button') {
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
  this.tabPanel.on('beforeremove', function(ct, panel) {
    if(panel.form && panel.form.isDirty()) {
      // Don't close it if it is dirty, pass in
      // a call back to close it.
      panel.form.on('actioncomplete', function() {
        ct.remove(panel);  
      }, null, {single:true});
      // TODO give the the chance to cancel their changes
      this.saveForm(panel.form);

      return false;
    } else {
      return true;
    }
  }, this);

  this.panels = {};
}
Ext.extend(TabbedCrudEditor, CrudEditor, {
  autoSaveInterval: 3000,

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

    var panel =  this.createEditPanel(record);

    this.tabPanel.add(panel);
    this.tabPanel.setActiveTab(panel);
    panel.doLayout();

    this.loadForm(panel.form, record);

    this.panels[record.id] = panel;
  },

  getPanel: function(record) { },
  createEditPanel: function(record) {
    var panel = this.getPanel(record);
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

    return panel;
  }
});
