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
    if(!this.editor)
      return;

    Ext.applyIf(this.editor, {
      store: this.store,
      crudPanel: this
    });

    // deleteRecord is the least commonly overloaded
    if (!this.editor.deleteRecord)
      this.editor = new DialogCrudEditor(this.editor);
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

    if(this.editor)  
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
