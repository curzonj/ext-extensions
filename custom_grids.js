SWorks.GridScrollSaver = function() {}
SWorks.GridScrollSaver.prototype = {
  init: function(comp) {
    comp.on('afterrender', function() {
      comp.container.on('afterlayout', function() {
        if(comp.savedScrollPos && comp.view) {
          comp.view.scroller.scrollTo('top', comp.savedScrollPos);
        }
      }, comp);
    }, comp);
    comp.on('bodyscroll', function(y, x) {
      comp.savedScrollPos = x;
    });
    comp.on('show', function() {
      if(comp.savedScrollPos && comp.view) {
        comp.view.scroller.scrollTo('top', comp.savedScrollPos);
      }
    });
  }
}

SWorks.CustomGrid = Ext.extend(Ext.grid.GridPanel, {
  autoSizeColumns: true,
  minColumnWidth: 5,

  initComponent: function() {
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
