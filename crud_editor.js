var CrudEditor = Ext.extend(Ext.Panel, {
  layout: 'fit',
  border: false,
  bodyStyle: "padding:10px",
  defaults: { border: false },

  initComponent: function() {
    CrudEditor.superclass.initComponent.call(this);
    var editorPanel = this;

    this.formPanel = this.findByType('form')[0];
    this.form = this.formPanel.form;
    this.cascade(function() {
      if(this != editorPanel && this.setParent)
        this.setParent(editorPanel);
    });

    this.relayEvents(this.form, ['load', 'beforeaction', 'actionfailed', 'actioncomplete']);
  },
  setParent: function(p) {
    this.parent = p;
  },
  createRecord: function(){
    //This doesn't load it into the dataStore because that should
    //reflect saved objects, this only exists in the form. The
    //record will be added into the dataStore if it is saved.
    var record = new this.store.reader.recordType();
    this.initializeRecord(record);

    if(this.parent && this.parent.newRecord()) {
      this.parent.form.on('actioncomplete', function() {
        //All we need is for parent.record.id to be valid
        //when we save. The only reason we wait to load the
        //record until the parent is saved is that will show
        //the window and we don't want that unless the parent
        //was successfull
        this.loadRecord(record);
      }, this, {single:true});
      this.parent.saveRecord();
    } else {
      this.loadRecord(record);
    }
  },
  newRecord: function() {
    return this.form.record.newRecord;
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
  initializeRecord: function(record){
    var keys = record.fields.keys;
    record.data = {};
    for(var i = 0, len = keys.length; i < len; i++){
      record.data[keys[i]] = "";
    }
    record.id = 'new';
    record.newRecord = true;
  },
  // TODO needs handle record locking
  loadRecord: function(record){
    this.form.record = record;

    this.beforeLoadRecord(record);

    this.form.trackResetOnLoad = true;
    this.form.loadRecord(record);
    this.form.clearInvalid();

    this.afterLoadRecord(record);
  },
  getRecord: function() {
    return this.form.getRecord();
  },
  beforeLoadRecord: function(record) {},
  afterLoadRecord: function(record) {},
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
  saveRecord: function(o){
    var record = this.form.record;

    // Prevents errors from holding the enter key
    // down too long or bouncing it
    if (this.form.submitLock)
      return;
    this.form.submitLock = true;

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

    this.form.submit(Ext.applyIf(o ,{
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
      } else if(!action.result.hidden) {
        // ext_override extensions
        form._onRecordUpdateLoaded = true;
        this.store.on('update', form.onRecordUpdate, form);
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
    record.data = result.data;
    record.id = record.data.id = result.objectid;

    if( result.hidden ) {
      if ( !record.newRecord && this.store.getById(record.id) ) 
        this.store.remove(record);
    } else {
      if(record.newRecord) {
        record.newRecord = false;
        this.store.add(record);
      }
      record.commit();
    }
  }
});

var DialogCrudEditor = function(config) {
  DialogCrudEditor.superclass.constructor.call(this, config);

  if(!this.dialog || !this.dialog.doLayout)
    this.createWindow();
}
Ext.extend(DialogCrudEditor, CrudEditor, {
  createWindow: function(config) {
    config = this.dialog || {};
    Ext.applyIf(config, {
      width: 500,
      height: 300,
      autoCreate: true,
      modal: true,
      closable: false,
      resizable: true,
      draggable: true,
      collapsible: false,
      title: 'Edit',
      layout: 'fit',
      items: this,
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
        this.saveRecord();
      }
  },
  onClickClose: function(trigger, e) {
    //Only function as a button handler on buttons, this makes
    //sure ENTER still works on other buttons
    if(typeof trigger == 'object' || e.target.type != 'button')
      this.dialog.hide();
  },
  loadRecord: function(record) {
    if(!this.dialog.rendered) {
      this.dialog.render(Ext.getBody());
    }

    DialogCrudEditor.superclass.loadRecord.call(this, record);

    this.dialog.show();
  }
});


var EditorTabs = function(config) {
  Ext.apply(this, config);

  this.panels = {};
}
EditorTabs.prototype =  {
  /* Defined Interface:
   * createRecord() - create and load a new record
   * loadRecord(record) - load it in something to edit
   * deleteRecord(record) - delete the record
   *
   * Common Access Methods:
   * beforeLoadRecord(record)
   * afterLoadRecord(record)
   * editor.form.an('load' (or 'actioncomplete'))
   */

    // TODO REMOVE YOUR LISTENERS WHEN YOU DIE
/*    tabPanel.on('beforeremove', function(ct, panel) {
      if(panel.form.isDirty()) {
        // Don't close it if it is dirty, pass in
        // a call back to close it.
        panel.form.on('actioncomplete', function() {
          ct.remove(panel);  
        }, null, {single:true});
        // TODO give the the chance to cancel their changes
        jobsList.onSaveRecord(panel.form);

        return false;
      } else {
        return true;
      }

      jobsFormPanel.jobSaveInterval = 3000
      jobsFormPanel.saveTask = new Ext.util.DelayedTask(function() {
        // Make sure we still exist and need to be saved
        if(this.form && this.form.el && this.form.isDirty()) {
          jobsList.onSaveRecord(this.form, { waitMsg: null});
        }
      }, jobsFormPanel);
      jobsFormPanel.on('render', function() {
        this.el.on('keydown', function() {
          this.saveTask.delay(this.jobSaveInterval);
        }, this);
      }, jobsFormPanel);
    });
*/
  deleteRecord: function(record) {
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

    var panel =  this.createEditPanel(record);
    if(!panel.doLayout)
      panel = new TabbedCrudEditor(panel);
    panel.setParent(this); //Cascades down to the subpanels

    this.tabPanel.add(panel);
    this.tabPanel.setActiveTab(panel);
    panel.doLayout();

    this.panels[record.id] = panel;
  },
  createEditPanel: function(record) {
  }
};

var TabbedCrudEditor = function(config) {
  Ext.applyIf(config, {
    closable: true,
    autoRender: true
  })

  TabbedCrudEditor.superclass.constructor.call(this, config);
}
Ext.extend(TabbedCrudEditor, CrudEditor, {
  initComponent: function() {
    TabbedCrudEditor.superclass.constructor.call(this);

    if(this.subPanel)
      this.subPanel.setParent(this);
  }
});
