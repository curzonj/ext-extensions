/*globals Ext, SWorks */

Ext.override(Ext.dd.DragDrop, {
  // This allows multiple things lock/unlock with a
  // little overlap, and they won't break each other
  lock: function(key) {
    this.lockKey = key;
    this.locked = true;
  },
  unlock: function(key) {
    if(!key || key == this.lockKey) {
      this.locked = false;
    }
  }
});

Ext.ux.grid.RowReorderDD = function(grid, config) {
  config = config || {};
  Ext.applyIf(config, {
    ddGroup: grid.ddGroup
  });

  Ext.apply(this, config);
  this.grid = grid;

  var gridEl = grid.getGridEl();
  if(gridEl) {
    this.lazyInit();
  } else {
    grid.on('render', this.lazyInit, this);
  }
};
Ext.extend(Ext.ux.grid.RowReorderDD, Ext.dd.DropZone, {
  lazyInit: function() {
    var dom = this.grid.getGridEl().dom;
    Ext.ux.grid.RowReorderDD.superclass.constructor.call(this, dom);

    this.view = this.grid.getView();

    // By registering on the grid's el, we get it's id
    // by default which conflicts with the header reorder DD id
    this.id = Ext.id();
    // Now reregister with our new id
    Ext.dd.DDM.regDragDrop(this, this.ddGroup);
  },

  getTargetFromEvent: function(e) {
    var t = Ext.lib.Event.getTarget(e);
    return this.view.findRow(t);
  },
  setHighlight: function(n, side) {
    if(side == 'top') {
      Ext.fly(n).
        addClass('sw-row-insert-top').
        removeClass('sw-row-insert-bottom');
    } else if(side == 'bottom') {
      Ext.fly(n).
        addClass('sw-row-insert-bottom').
        removeClass('sw-row-insert-top');
    } else {
      Ext.fly(n).
        removeClass('sw-row-insert-top').
        removeClass('sw-row-insert-bottom');
    }
  },
  onNodeOver: function(n, dd, e, data) {
    if(n.rowIndex == data.rowIndex) {
      return this.dropNotAllowed;
    }

    var y = Ext.lib.Event.getPageY(e);
    var r = Ext.lib.Dom.getRegion(n);
    if((r.bottom - y) <= (r.bottom-r.top)/2){
      if(n.rowIndex == data.rowIndex-1) {
        this.setHighlight(n, false);
        return this.dropNotAllowed;
      } else {
        this.setHighlight(n, 'bottom');
      }
    }else{
      if(n.rowIndex == data.rowIndex+1) {
        this.setHighlight(n, false);
        return this.dropNotAllowed;
      } else {
        this.setHighlight(n, 'top');
      }
    }

    return this.dropAllowed;
  },
  onNodeOut: function(n, dd, e, data) {
    this.setHighlight(n, false);
  },
  onRowChange: function(oldIndex, newIndex) {},
  onNodeDrop: function(n, dd, e, data) {
    if(n.rowIndex != data.rowIndex) {
      var y = Ext.lib.Event.getPageY(e);
      var r = Ext.lib.Dom.getRegion(n);
      var oldIndex = data.rowIndex;
      var newIndex = n.rowIndex + (((r.bottom - y) <= (r.bottom-r.top)/2) ? 1 : 0);
    
      this.onRowChange(oldIndex, newIndex);
    }

    return false;
  }
});
