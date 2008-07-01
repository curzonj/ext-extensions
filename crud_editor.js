/*globals Ext, SWorks */

Ext.namespace('SWorks');

SWorks.CrudEditor = function(config) {
  /* Defined Interface:
   * createRecord() - create and load a new record
   * loadRecord(record) - load it in something to edit
   * deleteRecord(record) - delete the record
   */
  this.initialConfig = config;
  Ext.apply(this, config);

  this.addEvents(
    'ready',
    'beforeaction',
    'actionfailed',
    'actioncomplete',
    'beforeload',
    'load',
    'delete',
    'save');

  SWorks.CrudEditor.superclass.constructor.call(this, config);

  this.initComponent();
  this.fireEvent('ready', this);
};
Ext.extend(SWorks.CrudEditor, Ext.util.Observable, {
  initComponent: Ext.emptyFn,
  parameterTemplate: "{0}",
  setupForm: function(form) {
    var index = new Ext.ux.data.CollectionIndex(form.items,
      function(o) {
        o.form = form;
        return o.dataIndex;
      }
    );
    form.fields = index.map;

    this.relayEvents(form, ['beforeaction', 'actionfailed', 'actioncomplete']);
  },
  isReadOnly: function(record) {
    var res = false;
    // TODO check permissions
    if (this.parent) {
      res = (res || this.parent.isReadOnly());
    }
    return res;
  },

  /*
   * Parent relation management
   * 
   */
  createParentRef: function(form) {
    var listenerDelegate = this.on.createDelegate(this);
    var saveParent = function(o) { this.saveForm(form, o); }.createDelegate(this);
    var isReadOnly = function() {
      if(form.record) {
        return this.isReadOnly(form.record);
      } else {
        return true;
      }
    }.createDelegate(this);

    return {
      form: form,
      daoClass: this.daoClass,
      save: saveParent,
      on: listenerDelegate,
      isReadOnly: isReadOnly
    };
  },
  findChildren: function(panel, form) {
    if(this.disableParentCascade) {
      return;
    }

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

    o.params = o.params || {};
    Ext.applyIf(o.params, this.serializeRecord(o.record));

    this.postToRecord(o);
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
    } else if(typeof rid != 'number') {
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

    // 3 prechecks:
    //
    // Is it readonly?
    if( this.isReadOnly(form.record) ) {
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

    // Then lets prepare the submit
    var record = form.record;
    o = this.setUpdateOrCreate(record, o);
    if(typeof o.waitMsg == 'undefined') {
      o.waitMsg = o.waitMsg || "Saving record...";
    }

    if(this.parent) {
      Ext.applyIf(o.params, this.getParentRelAttrs(record));
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
  checkServerChanges: function(form, action) {
    // The server may not return the same data we sent it,
    // we need to respect any changes it made. Don't reload
    // the form with everything sent back from the server because
    // the user might have made changes. updateOriginalValues marks
    // that any user changes are still dirty, but only the server
    // changes need to be updated in the form.
    var r = action.options.dataSentRecord;
    var d = action.result.data;

    for(var f in d) {
      if (form.fields[f] && r.data[f] != d[f]) {
        form.fields[f].setValue(d[f]);
      }
    }
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
        if (typeof result.data[a] != 'function') {
          var value = result.data[a];

          if(typeof value == 'object') {
            //record.set only takes non-objects
            record.data[a] = value;
          } else {
            record.set(a, value);
          }
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
  loadRecord: function(record) {},
  loadForm: function(form, record, panel){
    form.record = record;

    if(this.fireEvent('beforeload', form, record, panel) !== false) {

      this.onLoadForm(form, record, panel);
      this.fireEvent('load', form, record, panel);

      return true;
    } else {
      return false;
    }
  },
  onLoadForm: function(form, record, panel) {
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
      record.data.klass = record.data.klass || this.store.klass;

      options.cb.fn.call(options.cb.scope || this, record);
    } else {
      SWorks.ErrorHandling.serverError(result);
    }
  },
  reloadRecord: function(id) {
    var record = this.store.getById(id);

    if (record) {
      Ext.Ajax.jsonRequest(Ext.apply(o, {
        url: String.format(this.restUrl, id),
        callback: function(result, options) {
          this.updateRecord(record, result);
        },
        scope: this
      }));
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

    if(this.parent && this.parent.form &&
       this.parent.form.record.newRecord) {

      this.parent.save({
        callback: fn,
        scope: this
      });
    } else {
      fn.call(this);
    }
  },
  initializeRecord: function(record) {},

  /*
   * Delete existing Records
   *
   */
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

    return result;
  }
});

/*
 * This extracts everything that depends on a store, the events
 * stuff (of questionable importance), and cleaning "Select one..."
 * from empty combos on submit.
 */
SWorks.ManagedCrudEditor = Ext.extend(SWorks.CrudEditor, {
  initComponent: function() {
    SWorks.ManagedCrudEditor.superclass.initComponent.call(this);

    this.createUrl = this.store.url;
    this.restUrl = this.store.url + '/{0}';
    this.parameterTemplate = this.store.model + "[{0}]";
    this.daoClass = this.store.klass;
    this.recordType = this.store.recordType;

    this.store.on('metachange', function(grid, meta) {
      this.recordType = grid.recordType;
    }, this);
  },
  eventHandler: function(evt) {
    //example = callback: editor.eventHandler('disable', "Sorry, failed");
    return this.sendEvent.createDelegate(this, [evt], true);
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
  newRecord: function(data, initRecord) {
    var record = SWorks.ManagedCrudEditor.superclass.newRecord.apply(this, arguments);
    if (record && this.store) {
      record.data.klass = record.data.klass || this.store.klass;
    }

    return record;
  },
  updateRecord: function(record, result) {
    this.processRecords(result);
    SWorks.ManagedCrudEditor.superclass.updateRecord.call(this, record, result);
    if(record.newBeforeSave && !record.store &&
       record.constructor == this.store.recordType) {
      this.store.addSorted(record);
    }
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
            record = new this.recordType({}, r.id);
            store.addSorted(record);
            record.newBeforeSave = true;
          }
          // Don't use our own updateRecord because it'll try and add this record to our own
          // store, and it doesn't belong there
          SWorks.ManagedCrudEditor.superclass.updateRecord.call(this, record, {objectid:r.id, data:r});
          record.newBeforeSave = false;
        }
      }
    }
  }
});

SWorks.paneledCrudEditorOverrides = {
  //Call createPanel in your initComponents
  useDialog: true,
  createPanel: function() {
    var config = this.initialConfig;

    if(this.useDialog) {
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
    }

    var Type = this.useDialog ? Ext.Window : Ext.Panel;
    // JSlint wants Type to be capitalized
    this.panel = new Type(config);
    this.relayEvents(this.panel, ['beforerender', 'render']);

    if(this.useDialog) {
      this.dialog = this.panel;
      this.dialog.on('show', function(){
        this.dialog.keyMap.enable();

        // TODO focus is broken all over
        this.form.items.item(0).focus();
      }, this);
      this.dialog.saveBtn = this.dialog.buttons[0];

      // TODO disable the save button unless dirty and
      // warn about leaving w/o saving
    }

    this.formPanel = this.panel.findByType('form')[0];
    this.formPanel.border = false;
    this.formPanel.bodyStyle = "padding:10px";
    this.form = this.formPanel.form;
    this.panel.form = this.form;

    this.setupForm(this.form);
    this.findChildren(this.panel, this.form);
  },
  loadRecord: function(record) {
    if(!this.rendered && this.useDialog) {
      this.dialog.render(Ext.getBody());
    }

    if(this.loadForm(this.form, record, this.dialog) && this.useDialog) {
      if( this.isReadOnly(record) === true ) {
        this.formPanel.el.addClass('read-only');
        this.dialog.saveBtn.disable();
      } else {
        this.formPanel.el.removeClass('read-only');
        this.dialog.saveBtn.enable();
      }
      this.dialog.show();
    }
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
};


SWorks.PanelCrudEditor = Ext.extend(SWorks.ManagedCrudEditor, Ext.apply({
  initComponent: function() {
    SWorks.PanelCrudEditor.superclass.initComponent.call(this);
    this.createPanel();
  }
}, SWorks.paneledCrudEditorOverrides));

SWorks.LazyCrudEditor = Ext.extend(SWorks.CrudEditor, Ext.apply({
  initComponent: function() {
    SWorks.LazyCrudEditor.superclass.initComponent.call(this);
    this.createPanel();
  }
}, SWorks.paneledCrudEditorOverrides));


SWorks.TabbedCrudEditor = Ext.extend(SWorks.ManagedCrudEditor, {
  autoSaveInterval: 2000,
  maxAttempts: 3,
  initComponent: function() {
    SWorks.TabbedCrudEditor.superclass.initComponent.call(this);
  
    this.addEvents('newpanel');

    this.tabPanel.autoDestroy = false;
    this.tabPanel.on('beforeremove', this.onBeforeRemove, this);
    this.tabPanel.on('remove', this.onAfterRemove, this);

    this.panels = {};
    this.availablePanels = [];
  },
  onAfterRemove: function(ct, panel) {
    for(var a in this.panels) {
      if (panel == this.panels[a]) {
        delete this.panels[a];
      }
    }
    panel.autoSaveTask.cancel();
    this.availablePanels.push(panel);
  },
  onBeforeRemove: function(ct, panel) {
    if(panel.form &&
       !panel.form.bypassSaveOnClose &&
       panel.form.isDirty() &&
       !this.isReadOnly(panel.form.record)) {
      var closePanelFn = function() {
        panel.form.bypassSaveOnClose = true;
        ct.remove(panel);  
      };

      Ext.MessageBox.confirm("Save changes", "Do you want to save your changes?", function(btn) {
        // Often the data gets saved while the person choses
        if(btn == "yes" && (panel.form.record.newRecord || panel.form.isDirty() )) {
          this.saveForm(panel.form, {
            callback: closePanelFn
          });
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

    this.tabPanel.el.maskLoading();

    // Give the mask cpu time to render
    var editor = this;
    setTimeout(function() {
      panel = editor.findAvailablePanel();
      panel.setTitle(editor.getTitle(record));
      panel.form.bypassSaveOnClose = false;

      var formPanel = panel.findByType('form')[0];
      if( editor.isReadOnly(record) === true ) {
        formPanel.el.addClass('read-only');
      } else {
        formPanel.el.removeClass('read-only');
      }

      editor.loadForm(panel.form, record, panel);

      if(!record.newRecord) {
        editor.panels[record.id] = panel;
      }

      editor.tabPanel.add(panel);
      editor.tabPanel.setActiveTab(panel);
      panel.doLayout();

      editor.tabPanel.el.unmask();
    }, 1);
  },
  findAvailablePanel: function() {
    if (this.availablePanels.length > 0) {
      var panel = this.availablePanels[0];
      this.availablePanels = this.availablePanels.slice(1);

      return panel;
    } else {
      return this.createEditPanel();
    }
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

    this.relayEvents(panel, ['beforerender', 'render']);

    var formPanel = panel.findByType('form')[0];
    if (panel != formPanel) {
      panel.form = formPanel.form;
    }

    this.setupForm(panel.form);
    this.findChildren(panel, panel.form);
    this.configureAutoSave(panel);

    panel.hidden = true;
    panel.render(Ext.getBody());
    panel.doLayout();

    this.fireEvent('newpanel', panel, panel.form);

    return panel;
  },
  configureAutoSave: function(panel) {
    panel.autoSaveTask = new Ext.util.DelayedTask(function autoSave() {
      // Make sure we still exist and need to be saved
      if( panel.form &&
          panel.form.el &&
          panel.form.isDirty()) {
        this.saveForm(panel.form, { waitMsg: false });
      }
    }, this);
    panel.on('destroy', function() {
      this.store.un('update', panel.form.recordUpdateDelegate);

      if(panel.autoSaveTask) {
        panel.autoSaveTask.cancel();
      }
    }, this);

    var startTimer = function() {
      panel.autoSaveTask.delay(this.autoSaveInterval);
    };
    panel.form.on('actioncomplete', function(form, action) {
      panel.setTitle(this.getTitle(form.record));
      this.panels[form.record.id] = panel;
    }, this);
    panel.form.items.on('add', function(ct, cp) {
      cp.on('change', startTimer, this);
    }, this);
    panel.form.items.on('remove', function(ct, cp) {
      cp.un('change', startTimer, this);
    }, this);
    panel.form.on('actioncomplete', function() {
      this.autoSaveAttempts = 0;
    }, panel.form);
  }
});
