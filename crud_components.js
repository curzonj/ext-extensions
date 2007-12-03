var CrudStore = function(config) {
  var myPlugins = [
    new Ext.ux.data.LoadAttempts(),
    new Ext.ux.data.ReloadingStore(),
    new Ext.ux.data.PersistentFilters()
  ]
  config.plugins = (config.plugins || []).concat(myPlugins);

  // From JsonStore
  Ext.apply(config, {
     proxy: !config.data ? new Ext.data.HttpProxy({url: config.url}) : undefined,
     reader: new Ext.data.JsonReader(config, config.fields)
  })

  CrudStore.superclass.constructor.call(this, config);
}
Ext.extend(CrudStore, Ext.data.Store);

// To be included into classes and used there, not to be used
// directly.
var commonCrudPanelFunctions = {
  border: false,
  checkParentColumns: function(store, idCol) {
    if(!idCol) {
      store.hasParentType = function() { return false; };
    } else {
      var column = idCol.replace(/id/, "type");
      var value = (store.recordType.prototype.fields.keys.indexOf(column) != -1);

      store.parentIdColumn = idCol;
      store.hasParentType = function() { return value; }
      if(value)
        store.parentTypeColumn = idCol.replace(/id/, "type");
    }
  },
  checkToolbarButtons: function() {
    if(this.topToolbar && this.topToolbar.items)
      for(var i = 0; i < this.topToolbar.items.items.length; i++){
        var b = this.topToolbar.items.items[i];
        if(b.type == "button") {
          // A button by default is !readOnly and !gridOperation
          // If this isn't a readonly button and we dont' have permission
          if (!CurrentUser.has(this.rwPerm) && !b.readOnly) {
            b.disable();
          // If this works on rows and none are selected
          } else if(this.getSelections().length < 1 && !b.gridOperation) {
            b.disable();
          } else {
            b.enable();
          }
        }
      }
  },
  setupEditor: function() {
    this.editor = this.editor || {}
    Ext.applyIf(this.editor, {
      store: this.store,
      crudPanel: this
    });
    if (!this.editor.doLayout)
      this.editor = new CrudEditor(this.editor);
  },
  parentFilter: function(record){
    var idMatch = (record.data[this.store.parentIdColumn] == this.parent.form.record.id)
    var typeMatch = true;

    //Provides automatic filtering on polymophic relations
    if(this.store.hasParentType()) {
      typeMatch = (record.data[this.store.parentTypeColumn] == this.parent.store.klass)
    }

    return (idMatch && typeMatch)
  }
}

/* CRUDGridPanel
 */
var CRUDGridPanel = function(config) {
  Ext.applyIf(config, {
    // The menu keeps them out if they don't have RO
    // TODO change this back when permissions are done
    rwPerm: (config.store.root + '.view'),
    viewConfig: {
      forceFit:true
    },
    loadMask: {
      // Just mask the grid the first time,
      // after that we have data to show until
      // the load returns
      removeMask: true
    }
  });

  CRUDGridPanel.superclass.constructor.call(this, config);
}
// The crudgrid is not currently compatable with inline editing
Ext.extend(CRUDGridPanel, Ext.grid.GridPanel, {
  lifeCycleDelay: 300000, //5min

  initComponent: function() {
    CRUDGridPanel.superclass.initComponent.call(this);

    if(this.store.proxy)
      this.store.load();

    this.checkParentColumns(this.store, this.parentIdColumn);
    this.setupEditor();

    this.elements += ',tbar';
    this.topToolbar = this.createToolbar();
  
    this.colModel.defaultSortable = true;
    this.on('celldblclick', this.onGridCellClicked, this);
    this.on('cellclick', this.checkToolbarButtons, this);
    this.on('cellclick',this.saveSelections, this);
    this.store.on('load',this.restoreSelections, this);
    CurrentUser.onPermission(this.rwPerm, this.checkToolbarButtons, this);

    // TODO if there is a default custom view, load it
  },
  // Called by the parent
  setParent: function(p) {
    //Parent is a CrudEditor
    this.parent = p;
    this.editor.setParent(p);
    p.form.on('load', function(record) {
      this.store.addFilter(this.parentFilter, this);
    }, this);
  },
  afterRender: function() {
    CRUDGridPanel.superclass.afterRender.call(this);

    //The buttons don't exist until they are rendered, so
    //we catch them right here
    this.checkToolbarButtons();
  },
  createToolbar: function(){
    var tb = [];

    if (this.searchAndRefresh !== false) {
      tb.push(this.createOptionsMenu());
      tb.push('-');
      tb.push(new Ext.Toolbar.TextItem("Quicksearch"));
      tb.push(createFilterField(this.store));
      if(this.editor)
        tb.push('-');
    }

    if(this.editor) {
      tb.push({
        text: 'Add',
        gridOperation: true,
        handler: this.onClickAddBtn,
        scope: this
      });
      tb.push('-');
      tb.push({
        text: 'Edit',
        handler: this.onClickEditBtn,
        scope: this
      });
    }

    /* If you want a delete button, in btnConfigs pass in:
     * btnConfigs: [{
     *   text: 'Delete',
     *   handler: CRUDGridPanel.prototype.onClickDeleteBtn
     * }]
     *
     * To create event buttons, pass in something like:
     * btnConfigs: [{
     *   text: 'Fire',
     *   handler: function() {
     *     this.confirmMultipleRows(
     *       "Do you really want to fire <b>all {0} selected employees</b>?",
     *       "Please select at least on employee to fire.",
     *       this.onSendEvent.createDelegate(this, ['fire', 'Failed to fire employee(s). Please try again.'], true));
     *   },
     * }]
     */
    if(this.btnConfigs) {
      tb.push('-');
      for(var i=0;i<this.btnConfigs.length;i++) {
        var c = this.btnConfigs[i];
        Ext.applyIf(c, {
          scope: this
        });
        tb.push(this.btnConfigs[i]);
      }
    }

    if(tb.length > 0)
      return new Ext.Toolbar(tb);
  },
  createOptionsMenu: function(){
    var viewMenuOptions = [], groupByMenuOptions = [];

    if(this.customViews) {
      var cv = this.customViews;
      for(var i=0;i<cv.length;i++){
        var v = cv[i];
        var options = {
          group: 'customview',
          checked: (v.default == true),
          text: v.text,
          checkHandler: function() {
            var prev = this.store.customViewHander;
            if(prev)
              this.store.removeFilter(prev);

            this.store.customViewHandler = v.filter;
            this.store.addFilter(v.filter);

            // TODO Modify the title according to v.text
          }
        }
        viewMenuOptions.push(options);
      }
    }

    if(this.disableGrouping !== true) {
      var cm = this.initialConfig.columns || this.colModel.config;
      if(cm)
        for(var i=0;i<cm.length;i++){
          var c = cm[i];
          var options = {
            group: 'groupby',
            checked: false,
            text: c.header
            // TODO Add the handler to do the grouping
          }
          groupByMenuOptions.push(options);
        }
    }

    return {
      text: "Options",
      iconCls: 'boptions',
      menu: {
        items: [{
          text: "Group by",
          menu:{items:groupByMenuOptions},
          disabled: (groupByMenuOptions.length < 1)
        }, {
          text: "Custom View",
          menu:{items: viewMenuOptions},
          disabled: (viewMenuOptions.length < 1)
        },{
          text: 'Refresh',
          handler: this.onClickRefresh,
          scope: this,
          iconCls: 'brefresh'
        }]
      },
      readOnly: true,
      gridOperation: true,
    }
  },
  onClickAddBtn: function(){
    this.editor.createRecord();
  },
  onClickEditBtn: function(){
    //Will be disabled unless it has at least one selected
    var sel = this.getSelections()
    var r = sel[0]; 
    this.setRecordSelection(r)

    this.editor.loadRecord(r);
  },
  onClickDeleteBtn: function() {
    this.confirmMultipleRows(
      "Do you really want to delete <b>all {0} selected items</b>?",
      "Please select at least on item to delete.",
      this.editor.deleteRecord, this.editor);
  },
  // Default scope is the crudgrid
  confirmMultipleRows: function(msg, alt, fn, scope){
    var n = this.getSelections().length
    if(n > 0) {
      Ext.MessageBox.confirm('Message', String.format(msg, n),
        function(btn) {
          if(btn == 'yes') {
            var list = this.getSelections()
            for(var i = 0, len = list.length; i < len; i++){
              fn.call(scope||this, list[i]);
            }
          }
        }, this);	
    } else {
      Ext.MessageBox.alert('Message', alt);
    }
  },
  onClickRefresh: function(){
    //TODO
    //v = StatusBar.showStatusSpinner("Loading...");
    this.store.load(/*{callback:function(){StatusBar.finishStatusSpinner(v)}}*/);
  },
  onGridCellClicked: function(grid, rowIndex, cellIndex, e) {
    var r = this.store.getAt(rowIndex);
    this.setRecordSelection(r);
    if (this.editor && CurrentUser.has(this.rwPerm))
      this.editor.loadRecord(r);
  },
  setRecordSelection: function(r) {
    // select the right record if it exists
    if(this.store.indexOf(r) != -1)
      this.getSelectionModel().selectRecords([r],false)
  },
  saveSelections: function() {
    this.savedSelections = [];
    var selectedRows = this.getSelectionModel().getSelections();
    for (var i=0; i<selectedRows.length; i++) {
      this.savedSelections.push(selectedRows[i].id);
    };
  },
  restoreSelections: function() {
    if(this.savedSelections && this.savedSelections.length > 0) {
      var selectedRows = []
      for (var i=0; i<this.savedSelections.length; i++) {
        selectedRows.push(this.store.getById(this.savedSelections[i]));
      }
      this.getSelectionModel().selectRecords(selectedRows,false)
    }
  },
});
Ext.override(CRUDGridPanel, commonCrudPanelFunctions);

var CrudTreePanel = function(config) {
  config.store.load();

  config.nodes.store = config.store
  Ext.applyIf(config, {
    // TODO change this back when permissions are done
    rwPerm: (config.store.root + '.view'),
    plugins: new Ext.ux.tree.DataStoreBacking(config.nodes),
    root: new Ext.tree.TreeNode({expanded: true, id: 'root'})
  });

  //TODO implement drag-n-drop

  //TODO use a loader mask, combine some of this stuff with TreeComboBox
  CrudTreePanel.superclass.constructor.call(this, config);
}
Ext.extend(CrudTreePanel, Ext.tree.TreePanel, {
  animate: false,
  rootVisible: false,
  autoScroll: true,
  border: false,

  initComponent: function() {
    CrudTreePanel.superclass.initComponent.call(this);

    this.checkParentColumns(this.store, this.parentIdColumn);
    this.setupEditor();

    new Ext.tree.TreeSorter(this, {folderSort: true});

    this.elements += ',tbar';
    this.topToolbar = this.createToolbar();

    this.on('dblclick', this.onDblClickNode, this);
    CurrentUser.onPermission(this.rwPerm, this.checkToolbarButtons, this);
  },
  afterRender: function() {
    CrudTreePanel.superclass.afterRender.call(this);

    this.checkToolbarButtons();
  },
  createToolbar: function() {
    var tb = [{
      text: 'Refresh',
      gridOperation: true,
      readOnly: true,
      handler: this.onClickRefresh,
      scope: this
    }];

    if(this.editor) {
      tb.push('-');
      tb.push({
        text: 'Add',
        gridOperation: true,
        handler: this.onClickAddBtn,
        scope: this
      });
      tb.push('-');
      tb.push({
        text: 'Edit',
        handler: this.onClickEditBtn,
        scope: this
      });
    }

    /* If you want a delete button, in btnConfigs pass in:
     * btnConfigs: [{
     *   text: 'Delete',
     *   handler: CRUDGridPanel.prototype.onClickDeleteBtn
     * }]
     *
     * To create event buttons, pass in something like:
     * btnConfigs: [{
     *   text: 'Fire',
     *   handler: function() {
     *     this.confirmMultipleRows(
     *       "Do you really want to fire <b>all {0} selected employees</b>?",
     *       "Please select at least on employee to fire.",
     *       this.onSendEvent.createDelegate(this, ['fire', 'Failed to fire employee(s). Please try again.'], true));
     *   },
     * }]
     */
    if(this.btnConfigs) {
      tb.push('-');
      for(var i=0;i<this.btnConfigs.length;i++) {
        var c = this.btnConfigs[i];
        Ext.applyIf(c, {
          scope: this
        });
        tb.push(this.btnConfigs[i]);
      }
    }

    if(tb.length > 0)
      return new Ext.Toolbar(tb);
  },
  onClickRefresh: function() {
    this.store.reload();                
  },
  // For the sake of checkToolbarButtons
  getSelections: function() {
    node = this.getSelection();
    return [ node ];
  },
  getSelection: function() {
    var selModel = this.getSelectionModel();
    var node = selModel.getSelectedNode();

    return node;
  },
  // TODO Add and delete could be done via drag and drop, reordering could be too
  onClickAddBtn: function() {
    this.editor.createRecord();               
  },
  onClickEditBtn: function() {
    var node = this.getSelection();
    if(!node)
      return;

    this.editor.loadRecord(node.attributes.record);
  },
  onClickDeleteBtn: function() {
    var node = this.getSelection();
    if(!node)
      return;

    var msg = "Do you really want to delete {0}?";
    if(node.childNodes.length > 0)
      msg = "Do you really want to delete {0} <b>and all it's children</b>?";

    // TODO make this delete all the children too
    Ext.MessageBox.confirm("Confirmation", String.format(msg, node.text),
      function(btn) {
        if(btn == 'yes')
          this.editor.deleteRecord(node.attributes.record);
      }, this);
  },
  onDblClickNode: function(node, e) {
    this.editor.loadRecord(node.attributes.record);
  }
});
Ext.override(CrudTreePanel, commonCrudPanelFunctions);

// this.formPanel required
var CrudEditor = function(config) {
  // Needed incase they overload these functions we
  // use/reference right now
  Ext.apply(this, config);

  this.formPanel.bodyStyle = "padding:10px"
  if(this.subPanel) {
    this.formPanel.region = 'north';
    this.subPanel.region = 'center';
    Ext.applyIf(config, {
      layout: 'border',
      items: [ this.formPanel, this.subPanel ]
    });
  }

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
    items: this.formPanel,
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

  CrudEditor.superclass.constructor.call(this, config);

  this.form = this.formPanel.form;
  if(this.subPanel)
    this.subPanel.setParent(this);
}
Ext.extend(CrudEditor, Ext.Window, {
  initEvents: function() {
    CrudEditor.superclass.initEvents.call(this);

    this.on('show', function(){ this.keyMap.enable(); }, this);
    // TODO focus is broken all over
    //this.on('show', function(){ this.form.items.item(0).focus() }, this);
    //
    // TODO disable the save button unless dirty and
    // warn about leaving w/o saving
  },
  onClickSave: function(trigger, e) {
      //Only function as a button handler on buttons, this makes
      //sure ENTER still works on other buttons
      if(typeof trigger == 'object' || e.target.type != 'button') {
        this.keyMap.disable();
        this.form.on('actioncomplete', function() {
          this.hide();
        }, this, {single: true});
        this.form.on('actionfailed', function() {
          this.keyMap.enable();
        }, this, {single: true});
        this.saveRecord();
      }
  },
  onClickClose: function(trigger, e) {
      //Only function as a button handler on buttons, this makes
      //sure ENTER still works on other buttons
      if(typeof trigger == 'object' || e.target.type != 'button') {
        this.hide();
        // Stuff may have changed even if we arn't saving the form
        if(this.subPanel) { this.store.load() }
      }
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
    if (!record)
      return;

    if(!this.rendered)
      this.render(Ext.getBody());

    this.form.record = record;

    // If you want a different form for different records,
    // call setFormPanel in here. form.loadRecord will
    // reset form.record so don't worry about that.
    this.beforeLoadRecord(record);

    this.form.trackResetOnLoad = true;
    this.form.loadRecord(record);
    this.form.clearInvalid();

    this.afterLoadRecord(record);

    this.show();
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

/* **********************
 * Utility/helper methods and minor related Ext extensions
 *
 * **********************
 */

// TODO put this validation and rendering stuff in a namespace
var phoneNumberKeys = /[1234567890\-\ ]/;
var validatePhoneNumber = function(value) {
  var ph = value.replace(/\D/g, "")
  if(ph.length < 10) {
    return "Area code is required.";
  } else {
    return true;
  }
};
var zipCodeKeys = /[1234567890\-]/;
var zipCodeRegex = /\d{5}(?:-\d{4})?/g;

var renderBoolean = function(value){   
  return value ? "Yes" :  "No";
};

var createFilterField = function(store) {
  var filterRegexArray = null;

  var regexFilter = function(r) {
    var reArray = filterRegexArray //threading issues

    if(reArray)
      // This creates an implicit and between all words in the
      // search that is why we are looking for a false negative
      // instead of a positive match
      for (var i=0; i<reArray.length; i++) {
        var re = reArray[i];
        var decision = false;
        for (property in r.data) {
          if (re.test(r.data[property])==true) {
            // If any match, grid record is still a possibility
            decision = true;
          };
         }
         //If none of grid records fields match the current
         //keyword, grid record doesn't match the search
         if (decision == false)
           return false;
      }
    //All of the keywords matched somthing
    return true;
  }

  var applyGridFilter = function(filter) {
    if (filter.length==0) {
      store.removeFilter(regexFilter);
    } else {
      var value = filter.replace(/^\s+|\s+$/g, "");
      if (value=="") {
        store.removeFilter(regexFilter);
      } else {
        var valueArr = value.split(/\ +/);
        filterRegexArray = [];
        //TODO hook into the StatusBar spinner
        for (var i=0; i<valueArr.length; i++) {
          filterRegexArray.push(new RegExp(Ext.escapeRe(valueArr[i]), "i"));
        }

        store.addFilter(regexFilter);
      }
    }
  }

  var searchField = new Ext.form.TextField({
    tag: 'input',
    type: 'text',
    size: 30,
    hideTrigger: true,
    typeAhead:false,
    disableKeyFilter:true,
    value: ''
  });

  searchField.on('render', function() {
    searchField = Ext.get(searchField.getEl()); //convert from HTMLElement to Element
    searchField.on('keyup', function(e) {
      applyGridFilter(e.getTarget().value)
    }, null, {buffer: 250});
  });

  return searchField;
}


Ext.override(Ext.Panel, {
  setParent: function(parent) {
    if(this.items)
      this.items.each(function(i) {
        if(i.setParent)
          i.setParent(parent)
      });
  }
});

