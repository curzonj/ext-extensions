/*globals Ext, CSRFKiller */

Ext.namespace("Ext.ux", "Ext.ux.data", "Ext.ux.tree", "Ext.ux.grid"); //Used by extensions

// Required by data mirroring
Ext.override(Ext.util.Observable, {
  resetEvents: function() {
    var e, es = this.events;
    this.events = {};
    for(e in es) {
      this.events.e = true;
    }
  }
});

Ext.onReady(function() {
  if(CSRFKiller.field) {
    Ext.Ajax.on('beforerequest', function(conn, options) {
      if(typeof options.params == 'object') {
        //Make the two possibilities easier
        options.params = Ext.urlEncode(options.params);
      } 

      if(options.params && typeof options.params == "string") {
        options.params = options.params+'&'+CSRFKiller.field+'='+CSRFKiller.token;
      } else if(typeof options.params == 'undefined' && options.form) {
        options.params = CSRFKiller.field+'='+CSRFKiller.token;
      }
    });
  }
});

Ext.override(Ext.form.Field, {
  setFieldLabel: function(text) {
    var ct = this.el.findParent('div.x-form-item', 3, true);
    var label = ct.first('label.x-form-item-label');
    label.update(text);
  }
});

Ext.override(Ext.Element, {
  maskLoading: function(timeout) {
    this.mask('Loading...', 'x-mask-loading');

    if(timeout) {
      var me = this;
      setTimeout(function() {
        me.unmask();
      }, timeout);
    }
  }
});

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
      if(fn.call((scope || this),  node)) {
        return node;
      }
    }
  }
});
