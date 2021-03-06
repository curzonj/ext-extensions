/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks');

SWorks.CrudToolbarMgr = function(tbar, controller) {
  this.controller = controller;
  if ( tbar instanceof Array ) {
    this.tbar = new Ext.Toolbar(tbar);
  } else {
    this.tbar = tbar;
  }

  this.mangleToolbar(this.tbar);

  for(var i=0;i<this.tbar.buttons.length;i++) {
    var b = this.tbar.buttons[i];

    this.hookFilter(b);
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
      var b = this.tbar.items.items[i];
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

  mangleToolbar: function(tbar) {
    for(var i=0; i<tbar.buttons.length; i++) {
      var item = tbar.buttons[i];

      if (item.xtype == 'filter') {
        tbar.buttons = this.tbar.buttons.insertBefore(item, 'Quicksearch');
        i++;
      } else if(item.xtype == 'ferretfilter') {
        tbar.buttons = this.tbar.buttons.insertBefore(item, 'Adv Search');
        i++;
      }
    }
  },

  hookFilter: function(b) {
    if (typeof b.store == 'undefined') {
      var filters = [ 'filter', 'ferretfilter' ];

      if (filters.indexOf(b.xtype) != -1) {
        b.store = this.controller.component.store;
      }
    }
  },

  setPermissions: function(b) {
    if (b.text == 'Refresh') {
      Ext.applyIf(b, {
        gridOperation: true,
        readOnly: true
      });
    } else if (b.text == 'Add') {
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
    if (typeof b == 'object' && typeof b.text == 'string' ) {
      var text = b.text.replace(/ /,'');
      var handlerName = ('onClick' + text + 'Btn'),
          detectedHandler = this.controller[handlerName] || this[handlerName];

      if (b.text == 'Options' && typeof b.handler == 'undefined') {
        this.buildOptionsMenu(b);
      } else if (typeof b.handler == 'undefined' &&
                 typeof detectedHandler == 'function') {
        b.handler = detectedHandler;
      }

      if (typeof b.handler == 'function' &&
          typeof b.scope == 'undefined') {
        b.scope = this.controller;
      }
    }
  },

  /*
   * Default behaviors
   *
   * !! These run in the scope of the controller !!
   *
   */ 
  onClickAddBtn: function() {
    this.createRecord();
  },

  onClickEditBtn: function() {
    var r = this.getCurrentRecord();

    if (r) {
      this.loadRecord(r);
    }
  },

  onClickRefreshBtn: function() {
    this.dataModel.reload();
  },

  onClickDeleteBtn: function() {
    this.ifConfirmRecord('delete {0}', function(r) {
      if (r.id) {
        this.dataModel.deleteRecord(r);
      } else {
        r.store.remove(r);
      }
    }, this);
  },

  onClickHideBtn: function() {
    this.ifConfirmRecord('hide {0}', function(r) {
      if (r.id) {
        this.dataModel.deleteRecord(r);
      } else {
        r.store.remove(r);
      }
    }, this);
  },
  // End default behaviors

  onCustomFilterChecked: function(item, checked, filter) {
    this.controller.dataModel.onCustomFilter(checked, filter);
  },

  buildOptionsMenu: function(btn) {
    var list = this.buildFilterList(this.controller.component.customFilters) || [];
    if (list.length > 0) {
      list.push('-');
    }
    list.push({
      text: 'Refresh',
      iconCls: 'brefresh',
      handler: this.onClickRefreshBtn,
      scope: this.controller
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
          checkHandler: this.onCustomFilterChecked.createDelegate(this, [v], true)
        });

        if (v.isDefault === true) {
          this.onCustomFilterChecked(null, true, v);
        }
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
