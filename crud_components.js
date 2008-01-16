/*globals SWorks, Ext, ds */

ds = Ext.StoreMgr;

SWorks.CrudStore = function(config) {
  // From JsonStore
  Ext.applyIf(config, {
    sortInfo: { field: 'id', direction: 'ASC' },
    proxy: !config.data ? new Ext.data.HttpProxy({url: config.url}) : undefined,
    reader: new Ext.data.JsonReader(config, config.fields)
  });

  SWorks.CrudStore.superclass.constructor.call(this, config);

  // TODO change back to proper RW sometime
  this.rwPerm = this.root+'.view';

  Ext.ux.data.LoadAttempts(this);
  Ext.ux.data.ReloadingStore(this);
  Ext.ux.data.PersistentFilters(this);
};
Ext.extend(SWorks.CrudStore, Ext.data.GroupingStore, {
  linkToParent: function(p, idCol) {
    this.parentIdColumn = idCol;
    this.checkParentColumns(idCol);

    p.on('load', function(form, record) {
      if(!p.form || p.form == form) {
        //This deals with polymorphic relations
        this.relation_id = record.id;
        this.relation_type = p.store.klass; // New records do have a store

        this.addFilter(this.parentFilter, this);
      }
    }, this);
  },
  filterOnRelation: function(record) {
    //This deals with polymorphic relations
    this.relation_id = record.data.id;
    this.relation_type = record.data.type || record.store.klass;

    this.addFilter(this.parentFilter, this);
  },
  checkParentColumns: function(idCol) {
    if(idCol) {
      var column = idCol.replace(/id/, "type");
      var value = (this.recordType.prototype.fields.keys.indexOf(column) != -1);

      if(value) {
        this.parentTypeColumn = idCol.replace(/id/, "type");
      }
    }
  },
  parentFilter: function(record){
    var idMatch = (record.data[this.parentIdColumn] == this.relation_id);
    var typeMatch = true;

    //Provides automatic filtering on polymophic relations
    if(this.parentTypeColumn) {
      typeMatch = (record.data[this.parentTypeColumn] == this.relation_type);
    }

    return (idMatch && typeMatch);
  }
});

// To be included into classes and used there, not to be used
// directly.
SWorks.commonCrudPanelFunctions = {
  border: false,
  checkToolbarButtons: function() {
    if(this.topToolbar && this.topToolbar.items) {
      for(var i = 0; i < this.topToolbar.items.items.length; i++){
        var b = this.topToolbar.items.items[i];
        if(b.type == "button") {
          // A button by default is !readOnly and !gridOperation
          // If this isn't a readonly button and we dont' have permission
          if (!SWorks.CurrentUser.has(this.store.rwPerm) && !b.readOnly) {
            b.disable();
          // If this works on rows and none are selected
          } else if(this.getSelections().length < 1 && !b.gridOperation) {
            b.disable();
          } else {
            b.enable();
          }
        }
      }
    }
  },
  setupEditor: function() {
    if(!this.editor) {
      return;
    }

    // deleteRecord is the least commonly overloaded
    if (!this.editor.addListener) {
      this.editor = new SWorks.DialogCrudEditor(this.editor);
    }

    this.editor.crudPanel = this;
    if(!this.store) {
      this.store = this.editor.store;
    }

    if(!this.parentIdColumn && this.editor.parentIdColumn) {
      this.parentIdColumn = this.editor.parentIdColumn;
    }
  }
};

/* SWorks.CrudGridPanel
 */
SWorks.CrudGridPanel = function(config) {
/*  Ext.applyIf(config, {
    loadMask: {
      // Just mask the grid the first time,
      // after that we have data to show until
      // the load returns
      removeMask: true
    }
  }); */


  SWorks.CrudGridPanel.superclass.constructor.call(this, config);
};
// The crudgrid is not currently compatable with inline editing
Ext.extend(SWorks.CrudGridPanel, Ext.grid.GridPanel, {
  lifeCycleDelay: 300000, //5min
  autoSizeColumns: true,

  initComponent: function() {
    SWorks.CrudGridPanel.superclass.initComponent.call(this);

    this.addEvents('load', 'beforeload');

    this.setupEditor();

    if(this.store.loadIfNeeded) {
      this.store.loadIfNeeded();
    }

    if(this.store.groupBy) {
      this.view = new Ext.grid.GroupingView(Ext.apply({
        forceFit:true,
        enableNoGroups: true,
        hideGroupedColumn: true,
        groupTextTpl: '{text} ({[values.rs.length]} {[values.rs.length > 1 ? "Items" : "Item"]})'
      }, this.viewConfig));
    } else {
      this.view = new Ext.grid.GridView(Ext.apply({
        forceFit:true
      }));
    }

    this.elements += ',tbar';
    this.topToolbar = this.createToolbar();
  
    this.colModel.defaultSortable = true;
    this.on('celldblclick', this.onGridCellClicked, this);
    this.on('cellclick', this.checkToolbarButtons, this);
    this.store.on('load',this.restoreSelections, this);
    this.getSelectionModel().on('selectionchange',this.saveSelections, this);
    SWorks.CurrentUser.onPermission(this.store.rwPerm, this.checkToolbarButtons, this);

    // TODO if there is a default custom view, load it
  },
  afterRender: function() {
    SWorks.CrudGridPanel.superclass.afterRender.call(this);

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
      tb.push(SWorks.createFilterField(this.store));
      if(this.editor) {
        tb.push('-');
      }
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
     *   handler: SWorks.CrudGridPanel.prototype.onClickDeleteBtn
     * }]
     *
     * To create event buttons, pass in something like:
     * btnConfigs: [{
         text: "Cancel",
         handler: function() {
           this.confirmMultipleRows(
             "Do you really want to cancel <b>all {0} selected materials</b>?",
             "Please select at least one material to cancel.",
             this.editor.eventHandler('cancel', 'Failed to cancel material request. Please try again.')
         }
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

    if(tb.length > 0) {
      return new Ext.Toolbar(tb);
    }
  },
  createOptionsMenu: function(){
    var viewMenuOptions = [], groupByMenuOptions = [];

    if(this.customViews) {
      var cv = this.customViews;
      for(var i=0;i<cv.length;i++){
        var v = cv[i];
        var options = {
          group: 'customview',
          checked: (v.isDefault === true),
          text: v.text,
          checkHandler: function() {
            var prev = this.store.customViewHander;
            if(prev) {
              this.store.removeFilter(prev);
            }

            this.store.customViewHandler = v.filter;
            this.store.addFilter(v.filter);

            // TODO Modify the title according to v.text
          }
        };
        viewMenuOptions.push(options);
      }
    }

    return {
      text: "Options",
      iconCls: 'boptions',
      menu: {
        items: [{
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
      gridOperation: true
    };
  },
  onClickAddBtn: function(){
    this.editor.createRecord();
  },
  onClickEditBtn: function(){
    //Will be disabled unless it has at least one selected
    var r = this.grabCurrentRecordRow();
    this.editRecord(r);
  },
  onLoadRecord: function(record) {
    this.currentRecord = record;
    this.store.filterOnRelation(record);
  },
  loadRecord: function(record) {
    if(this.fireEvent('beforeload', this, record, this.dialog) !== false) {
      this.onLoadRecord(record);
      if(this.rendered) {
        this.getSelectionModel().clearSelections();
      }
      this.fireEvent('load', this, record, this.dialog);
    }
  },
  grabCurrentRecordRow: function() {
    //This makes changes, so it isn't just a getter
    var sel = this.getSelections();
    var r = sel[0]; 
    this.setRecordSelection(r);

    return r;
  },
  editRecord: function(r) {
    this.editor.loadRecord(r);
  },
  onClickDeleteBtn: function() {
    this.confirmMultipleRows(
      "Do you really want to delete <b>all {0} selected items</b>?",
      "Please select at least on item to delete.",
      this.editor.hideRecord,
      this.editor);
  },
  // Default scope is the crudgrid
  confirmMultipleRows: function(msg, alt, fn, scope){
    var n = this.getSelections().length;
    if(n > 0) {
      Ext.MessageBox.confirm('Message', String.format(msg, n),
        function(btn) {
          if(btn == 'yes') {
            var list = this.getSelections();
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
    this.store.reload(/*{callback:function(){StatusBar.finishStatusSpinner(v)}}*/);
  },
  onGridCellClicked: function(grid, rowIndex, cellIndex, e) {
    var r = this.store.getAt(rowIndex);
    this.setRecordSelection(r);
    if (this.editor && SWorks.CurrentUser.has(this.store.rwPerm)) {
      this.editRecord(r);
    }
  },
  setRecordSelection: function(r) {
    // select the right record if it exists
    if(this.store.indexOf(r) != -1) {
      this.getSelectionModel().selectRecords([r],false);
    }
  },
  saveSelections: function(sm) {
    this.savedSelections = [];
    var selectedRows = sm.getSelections();
    for (var i=0; i<selectedRows.length; i++) {
      this.savedSelections.push(selectedRows[i].id);
    }
  },
  restoreSelections: function() {
    if(this.savedSelections && this.savedSelections.length > 0) {
      var selectedRows = [];
      for (var i=0; i<this.savedSelections.length; i++) {
        selectedRows.push(this.store.getById(this.savedSelections[i]));
      }
      this.getSelectionModel().selectRecords(selectedRows,false);
    }
  },
  setParent: function(p) {
    this.parent = p;
    if(this.editor) {
      this.editor.setParent(p);
    }

    if(this.parentIdColumn) {
      this.store.linkToParent(p, this.parentIdColumn);
    }
  }
});
Ext.override(SWorks.CrudGridPanel, SWorks.commonCrudPanelFunctions);

SWorks.DependentUrlCrudGrid = Ext.extend(SWorks.CrudGridPanel, {
  setParent: function(p) {
    SWorks.DependentUrlCrudGrid.superclass.setParent(p);

    p.on('load', function(form, record) {
      if(form == p.form) {
        this.loadRecord(record);
      }
    }, this);
  },
  onLoadRecord: function(record) {
    this.currentRecord = record;
    this.loadGridRecords();
  },
  loadGridRecords: function() {
    if(!this.currentRecord.newRecord) {
      this.store.proxy.conn.url = 
        String.format(this.store.baseUrl, this.currentRecord.id);
      this.store.load();
    }
  },
  onClickRefresh: function() {
    SWorks.CrudEditor.prototype.executeOnFormSaved.call(
      this,
      this.parent.form,
      function() { this.parent.save(); },
      function() { this.loadGridRecords(); }
    );
  }
});

SWorks.CrudGridDialog = Ext.extend(SWorks.CrudGridPanel, {
  initComponent: function() {
    SWorks.CrudGridDialog.superclass.initComponent.call(this);

    if(!this.dialog) {
      this.createWindow();
    }

    this.on('load', function() {
      this.dialog.show();
    }, this);
  },
  createWindow: function() {
    var config = this.dialogConfig || {};

    Ext.applyIf(config, {
      width: 500,
      height: 300,
      autoCreate: true,
      modal: true,
      closable: true,
      closeAction: 'hide',
      resizeable: true,
      draggable: true,
      collapsible: false,
      defaults: { border: false },
      layout: 'fit',
      items: this,
      buttons: [{
        text: "Close",
        handler: this.onClickClose,
        scope: this
      }]
    });

    this.dialog = new Ext.Window(config);
  },
  onClickClose: function() {
    this.dialog.hide();
  }
});


SWorks.CrudTreePanel = function(config) {
  config.nodes.store = config.editor.store;

  Ext.applyIf(config, {
    plugins: new Ext.ux.tree.DataStoreBacking(config.nodes),
    root: new Ext.tree.TreeNode({expanded: true, id: 'root'})
  });

  //TODO implement drag-n-drop

  //TODO use a loader mask, combine some of this stuff with Ext.ux.TreeComboBox
  SWorks.CrudTreePanel.superclass.constructor.call(this, config);
};
Ext.extend(SWorks.CrudTreePanel, Ext.tree.TreePanel, {
  animate: false,
  rootVisible: false,
  autoScroll: true,
  border: false,

  initComponent: function() {
    SWorks.CrudTreePanel.superclass.initComponent.call(this);

    this.setupEditor();

    var mySorter = new Ext.tree.TreeSorter(this, {folderSort: true});

    this.elements += ',tbar';
    this.topToolbar = this.createToolbar();

    this.on('dblclick', this.onDblClickNode, this);
    SWorks.CurrentUser.onPermission(this.store.rwPerm, this.checkToolbarButtons, this);
  },
  afterRender: function() {
    SWorks.CrudTreePanel.superclass.afterRender.call(this);

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
     *   handler: SWorks.CrudGridPanel.prototype.onClickDeleteBtn
     * }]
     *
     * To create event buttons, pass in something like:
     * btnConfigs: [{
         text: "Cancel",
         handler: function() {
           this.confirmMultipleRows(
             "Do you really want to cancel <b>all {0} selected materials</b>?",
             "Please select at least one material to cancel.",
             this.editor.eventHandler('cancel', 'Failed to cancel material request. Please try again.')
         }
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

    if(tb.length > 0) {
      return new Ext.Toolbar(tb);
    }
  },
  onClickRefresh: function() {
    this.store.reload();                
  },
  // For the sake of checkToolbarButtons
  getSelections: function() {
    var node = this.getSelection();
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
    if(!node) {
      return;
    }

    this.editor.loadRecord(node.attributes.record);
  },
  onClickDeleteBtn: function() {
    var node = this.getSelection();
    if(!node) {
      return;
    }

    var msg = "Do you really want to delete {0}?";
    if(node.childNodes.length > 0) {
      msg = "Do you really want to delete {0} <b>and all it's children</b>?";
    }

    // TODO make this delete all the children too
    Ext.MessageBox.confirm("Confirmation", String.format(msg, node.text),
      function(btn) {
        if(btn == 'yes') {
          this.editor.deleteRecord(node.attributes.record);
        }
      }, this);
  },
  onDblClickNode: function(node, e) {
    this.editor.loadRecord(node.attributes.record);
  }
});
Ext.override(SWorks.CrudTreePanel, SWorks.commonCrudPanelFunctions);

/* **********************
 * Utility/helper methods and minor related Ext extensions
 *
 * **********************
 */

SWorks.getVtypeRegexFn = function(mask) {
  return function(value) {
    return mask.test(value);
  };
};

Ext.form.VTypes.phoneNumberText = "Phone number is invalid";
Ext.form.VTypes.phoneNumberMask = /[1234567890\-\ ]/;
Ext.form.VTypes.phoneNumber = function(value) {
  var ph = value.replace(/\D/g, "");
  if(ph.length < 10) {
    return "Area code is required.";
  } else {
    return true;
  }
};

Ext.form.VTypes.zipCodeText = "Zip code is invalid";
Ext.form.VTypes.zipCodeMask = /[1234567890\-]/;
Ext.form.VTypes.zipCode = SWorks.getVtypeRegexFn(/^\d{5}(?:-\d{4})?$/);

Ext.util.Format.yesNo = function(value){  
  return value ? "Yes" :  "No";
};
Ext.util.Format.dateMjy = function(value) {
  return Date.parseDate(value, 'Y/m/d H:i:s').format("M j Y");
};
Ext.util.Format.hourlyRate = function(v){
  return Ext.util.Format.usMoney(v) + " / hour";
};

SWorks.createFilterField = function(store) {
  var filterRegexArray = null;

  var regexFilter = function(r) {
    var reArray = filterRegexArray; //threading issues

    if(reArray) {
      // This creates an implicit and between all words in the
      // search that is why we are looking for a false negative
      // instead of a positive match
      for (var i=0; i<reArray.length; i++) {
        var re = reArray[i];
        var decision = false;
        for (var property in r.data) {
          if (re.test(r.data[property]) === true) {
            // If any match, grid record is still a possibility
            decision = true;
          }
         }
         //If none of grid records fields match the current
         //keyword, grid record doesn't match the search
         if (decision === false) {
           return false;
         }
      }
    }
    //All of the keywords matched somthing
    return true;
  };

  var applyGridFilter = function(filter) {
    if (filter.length===0) {
      store.removeFilter(regexFilter);
    } else {
      var value = filter.replace(/^\s+|\s+$/g, "");
      if (value==="") {
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
  };

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
      applyGridFilter(e.getTarget().value);
    }, null, {buffer: 250});
  });

  return searchField;
};
