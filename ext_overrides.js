Ext.namespace("Ext.ux", "Ext.ux.data", "Ext.ux.tree"); //Used by extensions

// Required by data mirroring
Ext.override(Ext.util.Observable, {
  resetEvents: function() {
    var es = this.events
    this.events = {}
    for(e in es) {
      this.events.e = true;
    }
  }
});

// This operates on Observable, I'm not yet sure how to make
// the changes directly. Observable is a nice root class
// to add this feature to.
Ext.data.Store.superclass.original_constructor = Ext.data.Store.superclass.constructor;
Ext.data.Store.superclass.constructor = function() {
  if(this.plugins) {
    if(this.plugins instanceof Array) {
      for(var i = 0, len = this.plugins.length; i < len; i++) {
        this.plugins[i].init(this);
      }
    } else {
      this.plugins.init(this);
    }
  }

  Ext.data.Store.superclass.original_constructor.call(this);
}
Ext.override(Ext.data.Store, {
  // Their load records function isn't very extensible,
  // so I had to copy it in here
  loadRecords : function(o, options, success){
    if(!o || success === false){
        if(success !== false){
            this.fireEvent("load", this, [], options);
        }
        if(options.callback){
            options.callback.call(options.scope || this, [], options, false);
        }
        return;
    }
    var r = o.records, t = o.totalRecords || r.length;
    if(!options || options.add !== true){
        if(this.pruneModifiedRecords){
            this.modified = [];
        }
        for(var i = 0, len = r.length; i < len; i++){
            r[i].join(this);
        }
        if(this.snapshot){
            this.data = this.snapshot;
            delete this.snapshot;
        }
        this.data.clear();
        this.data.addAll(r);
        this.totalLength = t;

        this.onDataChanged(); //This line added

        this.fireEvent("datachanged", this);
    }else{
        this.totalLength = Math.max(t, this.data.length+r.length);
        this.add(r);
    }

    this.fireEvent("load", this, r, options);
    if(options.callback){
        options.callback.call(options.scope || this, r, options, true);
    }
  },
  onDataChanged: function() {
    this.applySort();
  }
});


Ext.override(Ext.tree.TreeNodeUI, {
  onDblClick : function(e){
    e.preventDefault();
    if(this.disabled){
      return;
    }
    if(this.checkbox){
      this.toggleCheck();
    }
    // Removed expanding the node, put a dblclick
    // listener on if you want it
    this.fireEvent("dblclick", this.node, e);
  }
});

Ext.override(Ext.Window, {
  showMask: function() {
    if(this.modal){
      Ext.getBody().addClass("x-body-masked");
      this.mask.setSize(Ext.lib.Dom.getViewWidth(true), Ext.lib.Dom.getViewHeight(true));
      this.mask.show();
    }
  },
  hideMask: function() {
    if(this.modal){
      this.mask.hide();
      Ext.getBody().removeClass("x-body-masked");
    }
  }
});

Ext.override(Ext.tree.TreePanel, {
  findNode: function(prop, value) {
    return this.findNodeBy(function(node) {
      return (node.attributes[prop] == value);
    });
  },
  findNodeBy: function(fn, scope) {
    for (var id in this.nodeHash) {
      var node = this.nodeHash[id];
  
      // It's up to the user to specify unique
      // constraints
      if(fn.call((scope || this),  node))
        return node;
    }
  }
});
