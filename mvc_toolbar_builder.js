/*globals SWorks, Ext */

SWorks.CrudToolbarMgr = function(tbar, controller) {
  this.controller = controller;
  if ( tbar instanceof Array ) {
    this.tbar = new Ext.Toolbar(tbar);
  } else {
    this.tbar = tbar;
  }

  for(var i=0;i<this.tbar.buttons.length;i++) {
    var b = this.tbar.buttons[i];

    this.setupHandlers(b);
    this.setPermissions(b);
  }
  /* TODO
   *   Wire toolbar buttons
   *   check toolbar buttons
   */
};
SWorks.CrudToolbarMgr.prototype = {

  checkToolbarButtons: function() {
    for(var i = 0; i < this.tbar.items.items.length; i++){
      var b = this.topToolbar.items.items[i];
      if(b.type == "button") {
        if(this.tbButtonCheck(b)) {
          b.enable();
        } else {
          b.disable();
        }
      }
    }
  },

  tbButtonCheck: function(b) {
    var isSelected  = (typeof this.controller.getCurrentRecord() == 'object');

    // A button by default is !readOnly and !gridOperation
    return ((b.readOnly === true || !this.controller.isReadOnly()) &&
            (b.gridOperation === true || isSelected));
  },

  getToolbar: function() {
    return this.tbar;
  },

  setPermissions: function(b) {
    if (b.text == 'Add') {
      Ext.applyIf(b, {
        gridOperation: true,
        readOnly: false
      });
    } else if(b.text == 'Edit') {
      Ext.applyIf(b, {
        gridOperation: false,
        readOnly: true //The editor has it's own readonly handlers
      });
    }
  },

  setupHandlers: function(b) {
    if (typeof b == 'object') {
      if (b.text == 'Options' && typeof b.handler == 'undefined') {
        this.buildOptionsMenu(b);
      } else if (typeof b.text == 'string' &&
                 typeof b.handler == 'undefined' &&
                 typeof this['onClick' + b.text + 'Btn'] == 'function') {
        Ext.applyIf(b, {
          handler: this['onClick' + b.text + 'Btn'],
          scope: this
        });
      }

      if (typeof b.text == 'string' &&
          typeof b.handler == 'function' &&
          typeof b.scope == 'undefined') {
        b.scope = this.controller;
      }
    }
  },

  onClickAddBtn: function() {
    this.controller.createRecord();
  },

  onClickEditBtn: function() {
    var r = this.controller.getCurrentRecord();
    this.controller.editRecord(r);
  },

  onClickRefresh: function() {
    this.controller.dataModel.reload();
  },

  onCustomFilterChecked: function(item, checked, filter) {
    var store = this.controller.dataModel;

    if (checked) {
      store.addFilter(filter.filter);
    } else {
      store.removeFilter(filter.filter);
    }
  },

  buildOptionsMenu: function(btn) {
    var list = this.buildFilterList(this.controller.customFilters) || [];
    if (list.length > 0) {
      list.push('-');
    }
    list.push({
      text: 'Refresh',
      iconCls: 'brefresh',
      handler: this.onClickRefresh,
      scope: this
    });

    Ext.applyIf(btn, {
      iconCls: 'boptions',
      readOnly: true,
      gridOperation: true,
      menu: list
    });
  },

  buildFilterList: function(filters) {
    if(filters) {
      var filterItems = [];

      for(var i=0;i<filters.length;i++){
        var v = filters[i];
        filterItems.push({
          checked: (v.isDefault === true),
          text: v.text,
          checkedHandler: this.onCustomFilterChecked.createDelegate(this, [v], true)
        });
      }

      return filterItems;
    }
  }
};


  
/*  createToolbar: function(){
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
      tb.push({ text: 'Add' });
      tb.push('-');
      tb.push({ text: 'Edit' });
    }

    if(tb.length > 0) { return tb; }
  },
  addToolbarSearch: function(tbArr) {
    tbArr.push(new Ext.Toolbar.TextItem("Quicksearch"));
    tbArr.push(SWorks.createFilterField(this.store));
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
  }, */
