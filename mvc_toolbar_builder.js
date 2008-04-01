SWorks.CrudToolbarBuilder = function(tbar, controller) {
  this.tbar = tbar;
  this.controller = controller;
  /* TODO
   *   Wire toolbar buttons
   *   check toolbar buttons
   */
}
SWorks.CrudToolbarBuilder.prototype = {
  onClickAddBtn: function() {
    this.controller.createRecord();
  },
  onClickEditBtn: function() {
    var r = this.controller.getCurrentRecord();
    this.controller.editRecord(r);
  }
}


  
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
  } */
