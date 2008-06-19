/*globals SWorks, Ext */

// To be included into classes and used there, not to be used
// directly.
SWorks.commonCrudPanelFunctions = {
  border: false,
  checkToolbarButtons: function() {
    if(this.topToolbar && this.topToolbar.items) {
      for(var i = 0; i < this.topToolbar.items.items.length; i++){
        var b = this.topToolbar.items.items[i];
        if(b.type == "button") {
          if(this.tbButtonCheck(b)) {
            b.enable();
          } else {
            b.disable();
          }
        }
      }
    }
  },
  isReadOnly: function() {
    var res = !SWorks.CurrentUser.has(this.rwPerm);
    // TODO check permissions
    if (this.parent) {
      res = (res || this.parent.isReadOnly());
    }
    return res;
  },
  tbButtonCheck: function(b) {
    // A button by default is !readOnly and !gridOperation
    return ((b.readOnly === true || !this.isReadOnly()) &&
            (b.gridOperation === true || this.getSelections().length > 0)) ;
  },
  setupEditor: function() {
    if(!this.editor) {
      return;
    }

    if (!this.editor.addListener) {
      Ext.applyIf(this.editor, {
        store: this.store
      });

      this.editor = new SWorks.PanelCrudEditor(this.editor);
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

SWorks.CrudGridPanel = Ext.extend(Ext.grid.GridPanel, {
  autoSizeColumns: true,
  minColumnWidth: 5,

  initComponent: function() {
    this.setupEditor();
    this.setupStore();

    this.tbar = this.createToolbar();

    SWorks.CrudGridPanel.superclass.initComponent.call(this);

    this.addEvents('load', 'beforeload');
  
    this.colModel.defaultSortable = true;
    this.on('afterrender', function() {
      this.container.on('afterlayout', function() {
        if(this.savedScrollPos && this.view) {
          this.view.scroller.scrollTo('top', this.savedScrollPos);
        }
      }, this);
    }, this);
    this.on('bodyscroll', function(y, x) {
      this.savedScrollPos = x;
    });
    this.on('show', function() {
      if(this.savedScrollPos && this.view) {
        this.view.scroller.scrollTo('top', this.savedScrollPos);
      }
    });
    this.on('celldblclick', this.onGridCellClicked, this);
    this.getSelectionModel().on('selectionchange', this.checkToolbarButtons, this);
    SWorks.CurrentUser.onPermission(this.rwPerm, this.checkToolbarButtons, this);
  },
  setupStore: function() {
    if(this.store.loadIfNeeded) {
      this.store.loadIfNeeded();
    }

    if(this.parentIdColumn) {
      this.store.checkParentColumns(this.parentIdColumn);
    }
  },
  getView: function() {
    if(!this.view) {
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
        }, this.viewConfig));
      }
    }

    return this.view;
  },
  loadMask: { removeMask: true },
  afterRender: function() {
    SWorks.CrudGridPanel.superclass.afterRender.call(this);

    //The buttons don't exist until they are rendered, so
    //we catch them right here
    this.checkToolbarButtons();

    if(this.store.proxy &&
       this.store.proxy.activeRequest &&
       this.loadMask) {
      this.loadMask.show();
    }
  },
  addToolbarSearch: function(tbArr) {
    tbArr.push(new Ext.Toolbar.TextItem("Quicksearch"));
    tbArr.push(SWorks.createFilterField(this.store));
  },
  createToolbar: function(){
    var tb = [];

    if (this.searchAndRefresh !== false) {
      tb.push(this.createOptionsMenu());
      tb.push('-');
      this.addToolbarSearch(tb);
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
        readOnly: true, //The editor has it's own readonly handlers
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
    btnConfigs: [{
      text: "Discard",
      handler: function() {
        this.confirmMultipleRows(
          "Do you really want to discard <b>all {0} selected items</b>?",
          this.editor.eventHandler('discard'))
      }
    }],
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
  buildFilterList: function(menuArr) {
    if(this.customFilters) {
      var cv = this.customFilters;
      for(var i=0;i<cv.length;i++){
        var v = cv[i];
        var options = {
          checked: (v.isDefault === true),
          text: v.text,
          filterFn: v.filter,
          checkHandler: function(item, checked) {
            if (checked) {
              this.store.addFilter(item.filterFn);
            } else {
              this.store.removeFilter(item.filterFn);
            }
          },
          scope: this
        };
        if(v.isDefault === true) {
          this.store.addFilter(v.filter);
        }
        menuArr.push(options);
      }
    }
  },
  createOptionsMenu: function(){
    var viewMenuOptions = [], groupByMenuOptions = [];

    this.buildFilterList(viewMenuOptions);
    if(viewMenuOptions.length > 0) {
      viewMenuOptions.push('-');
    }

    return {
      text: "Options",
      iconCls: 'boptions',
      menu: {
        items: viewMenuOptions.concat([{
          text: 'Refresh',
          handler: this.onClickRefresh,
          scope: this,
          iconCls: 'brefresh'
        }])
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
 //   this.setRecordSelection(r);

    return r;
  },
  editRecord: function(r) {
    if(this.editor) {
      this.editor.loadRecord(r);
    }
  },
  onClickHideBtn: function() {
    this.confirmMultipleRows(
      "Do you really want to delete <b>all {0} selected items</b>?",
      this.editor.hideRecord,
      this.editor);
  },
  onClickDeleteBtn: function() {
    this.confirmMultipleRows(
      "Do you really want to delete <b>all {0} selected items</b>?",
      this.editor.deleteRecord,
      this.editor);
  },
  // Default scope is the crudgrid
  confirmMultipleRows: function(msg, fn, scope){
    var n = this.getSelections().length;
    if(n > 0) {
      Ext.MessageBox.confirm('Message', String.format(msg, n),
        this.onClickConfirmation.createDelegate(this, [fn, scope], true));
    } else {
      Ext.MessageBox.alert('Message', "Please select at least one item.");
    }
  },
  confirmSingleRow: function(msg, fn, scope) {
    var n = this.getSelections().length;
    if(n === 0) {
      Ext.MessageBox.confirm('Message', msg,
        this.onClickConfirmation.createDelegate(this, [fn, scope], true));
    } else {
      Ext.MessageBox.alert('Message', "Please select only one item");
    }
  },
  onClickConfirmation: function(btn, empty, fn, scope) {
    if(btn == 'yes') {
      var list = this.getSelections();
      for(var i = 0, len = list.length; i < len; i++){
        fn.call(scope||this, list[i]);
      }
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
    this.editRecord(r);
  },
  setRecordSelection: function(r) {
    // select the right record if it exists
    if(this.store.indexOf(r) != -1) {
      this.getSelectionModel().selectRecords([r],false);
    }
  },
  setParent: function(p) {
    this.parent = p;
    if(this.editor) {
      this.editor.setParent(p);
    }

    p.on('load', function() {
      this.checkToolbarButtons();
    }, this);

    if(this.parentIdColumn) {
      this.store.linkToParent(p, this.parentIdColumn);
    }
  }
});
Ext.override(SWorks.CrudGridPanel, SWorks.commonCrudPanelFunctions);

SWorks.SearchCrudGrid = Ext.extend(SWorks.CrudGridPanel, {
  page_size: 100,
  loadMask: true,

  initComponent: function() {
    Ext.applyIf(this, {
      bbar: new Ext.PagingToolbar({
        pageSize: this.page_size,
        store: this.store,
        displayInfo: true,
        displayMsg: 'Displaying items {0} - {1} of {2}',
        emptyMsg: "No items to display"
      })
    });

    SWorks.SearchCrudGrid.superclass.initComponent.call(this);

    this.on('render', function() {
      this.store.load();
    }, this);
  },
  setupStore: function() {
    this.store.baseParams = this.store.baseParams || {};
    this.store.baseParams.limit = this.page_size;

    this.editor.on('save', function(r, res) {
      if (res.ferret_data) {
        var myrecord = this.store.getById(res.objectid) ||
                       new this.store.recordType(res.ferret_data, res.objectid);
        this.editor.updateRecord(myrecord, { data: res.ferret_data });
      } else {
        this.store.reload();
      }
    }, this);

    SWorks.SearchCrudGrid.superclass.setupStore.call(this);
  },
  addToolbarSearch: function(tbArr) {
    tbArr.push(new Ext.Toolbar.TextItem("Adv Search"));

    var searchFn, searchField = new Ext.form.TextField({
      size: 30, // Something is replacing this with 20, but if it is
                // missing, the field is tiny
      value: '',
      listeners: {
        'specialkey': function(item, e) {
          var key = e.getKey();
          if (key == Ext.EventObject.ENTER) {
            searchFn.call(this);
          }
        },
        scope: this
      }
    });

    searchFn = function() {
      var str = searchField.getValue().trim();

      if (str === '') {
        this.store.removeFilter('search');
      } else {
        this.store.addFilter('search', '+('+str+')');
      }
      this.store.load();
    };

    tbArr.push(searchField);
  },
  buildFilterList: function(menuArr) {
    if(this.customFilters) {
      var cv = this.customFilters;
      for(var i=0;i<cv.length;i++){
        var v = cv[i];
        var options = {
          checked: (v.isDefault === true),
          text: v.text,
          query: v.query,
          getQuery: v.getQuery,
          checkHandler: function(item, checked) {
            if (checked) {
              this.store.addFilter(item.text, (item.query || item.getQuery.call(this)));
            } else {
              this.store.removeFilter(item.text);
            }

            this.store.load();
          },
          scope: this
        };
        if (v.isDefault === true) {
          this.store.addFilter(v.text, (v.query || v.getQuery()));
        }
        menuArr.push(options);
      }
    }
  },
  editRecord: function(r) {
    var e = this.editor;
    if(e) {
      e.fetchRecord(r.id, {
        callback: function(record) {
          e.loadRecord(record);
        }
      });
    }
  }
});

SWorks.DependentUrlCrudGrid = Ext.extend(SWorks.CrudGridPanel, {
  setupStore: function() {
    if(this.store.mirrorSource) {
      console.error("Dependent Url grids can't use cloned/mirrored stores. Bad things will happen");
    }

    delete this.store.loadIfNeeded;

    SWorks.DependentUrlCrudGrid.superclass.setupStore.call(this);
  },
  setParent: function(p) {
    this.parent = p;
    if(this.editor) {
      this.editor.setParent(p);
    }

    p.on('load', function(form, record) {
      if(form == p.form) {
        this.checkToolbarButtons();
        this.loadRecord(record);
      }
    }, this);
  },
  onLoadRecord: function(record) {
    this.currentRecord = record;
    this.loadGridRecords();
  },
  loadGridRecords: function() {
    if(this.currentRecord.newRecord) {
      this.store.removeAll();
    } else {
      var r = this.currentRecord, s = this.store, url = s.baseUrl;
      if(!url && s.parentIdColumn) {
        url = s.url + '?' + s.parentIdColumn + '={0}';
        if(s.parentTypeColumn) {
          url = url + '&' + s.parentTypeColumn + '={1}';
        }
      }

      if(url) {
        var klass = r.getKlass() || ( this.parent && this.parent.store ?
                                              this.parent.store.klass : null );

        s.proxy.conn.url = String.format(url, r.id, klass);
        s.load();
      } else {
        console.error("This store doesn't have a url");
      }
    }
  },
  onClickRefresh: function() {
    var p = this.parent;
    if(p && (p.form.newRecord || p.form.isDirty())) {
      p.save({
        callback: this.loadGridRecords,
        scope: this
      });
    } else {
      this.loadGridRecords();
    }
  }
});

SWorks.dialogOnLoad = function(grid, config) {
  var dialog;

  config = config || {};
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
    items: grid,
    buttons: [{
      text: "Close",
      handler: function() { dialog.hide(); }
    }]
  });

  dialog = new Ext.Window(config);
  grid.dialog = dialog;

  grid.on('load', function() {
    dialog.show();
  }, this);
};

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
    this.setupEditor();
    this.tbar = this.createToolbar();

    SWorks.CrudTreePanel.superclass.initComponent.call(this);

    if(this.store.loadIfNeeded) {
      this.store.loadIfNeeded();
    }

    var mySorter = new Ext.tree.TreeSorter(this, {folderSort: true});

    this.on('dblclick', this.onDblClickNode, this);
    SWorks.CurrentUser.onPermission(this.rwPerm, this.checkToolbarButtons, this);
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
             this.editor.eventHandler('cancel')
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
  onClickHideBtn: function() {
    var node = this.getSelection();
    if(!node) {
      return;
    }

    var msg = "Do you really want to hide {0}?";
    if(node.childNodes.length > 0) {
      msg = "Do you really want to hide {0} <b>and all it's children</b>?";
    }

    // TODO make this hide all the children too
    Ext.MessageBox.confirm("Confirmation", String.format(msg, node.text),
      function(btn) {
        if(btn == 'yes') {
          this.editor.hideRecord(node.attributes.record);
        }
      }, this);
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
    size: 30,
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
