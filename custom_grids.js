/*globals SWorks, Ext */

Ext.override(Ext.grid.GridView, {
  // By default it scrolls to the top
  onLoad: Ext.emptyFn,
});

SWorks.CustomGrid = Ext.extend(Ext.grid.GridPanel, {
  autoSizeColumns: true,
  minColumnWidth: 5,

  initComponent: function() {
    this.sm = new Ext.grid.RowSelectionModel({singleSelect:true});

    SWorks.CustomGrid.superclass.initComponent.call(this);

    this.colModel.defaultSortable = true;

    new SWorks.GridScrollSaver().init(this);
  },
  loadMask: { removeMask: true },
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
  }
});

SWorks.GridScrollSaver = function() {}
SWorks.GridScrollSaver.prototype = {
  init: function(grid) {
    // Called in the scope of the grid
    var returnToSavedPosition = function() {
      if(this.savedScrollPos && this.view && 
         this.ownerCt.layout.activeItem == this) {
        this.view.scroller.scrollTo('top', this.savedScrollPos);
      }
    };

    grid.on('bodyscroll', function(y, x) { grid.savedScrollPos = x; });

    grid.on('show',     returnToSavedPosition, grid);
    grid.on('activate', returnToSavedPosition, grid);

    grid.on('render', function() {
      grid.ownerCt.on('afterlayout', returnToSavedPosition, grid);
      grid.view.on('refresh',        returnToSavedPosition, grid);
    });
  },
};
