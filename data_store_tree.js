/*globals Ext */

//required: store, textField; optional: idField, parentIdField, qtipField
Ext.ux.tree.DataStoreBacking = function(config) {
  Ext.apply(this, config);
};
Ext.ux.tree.DataStoreBacking.prototype = {
  idField: 'id',
  parentIdField: 'parent_id',

  init: function(tree) {
    this.tree = tree;

    this.tree.on('beforeexpandnode', this.onBeforeExpandNode, this);
    // TODO Link the tree to the loading mask of the data store
    this.tree.on('beforeappend', this.onBeforeAppend, this);
    this.tree.on('beforeremove', this.onBeforeRemove, this);

    if(this.keepUpdated !== false) {
      this.store.on('load', this.onDataStoreReloaded, this);
      this.store.on('add', this.onDataStoreAdd, this);
      this.store.on('remove', this.onDataStoreRemove, this);
      this.store.on('update', this.onDataStoreUpdate, this);
    }
  },
  onBeforeAppend: function(tree, parent, node) {
    parent.childMap = parent.childMap || {};
    parent.childMap[node.attributes.record.id] = node;
  },
  onBeforeRemove: function(tree, parent, node) {
    var nodeId = node.attributes.record.id;
    delete parent.childMap[nodeId];
  },
  onBeforeExpandNode: function(node, deep, anim) {
    if(!node.childNodes || node.childNodes.length === 0) {
      this.reloadChildren(node);
    }
  },
  onDataStoreReloaded: function() {
    var root = this.tree.getRootNode();
    this.reloadChildren(root);
  },
  onDataStoreAdd: function(store, records, index) {
    for(var i=0; i<records.length; i++) {
      var record = records[i];
      for(var id in this.tree.nodeHash) {
        var node = this.tree.nodeHash[id],
            parentId = this.extractRecordId(node);

        if(record.data[this.parentIdField] == parentId) {
          this.createChild(node, record);
        }
      }
    }
  },
  onDataStoreRemove: function(store, record, index) {
    var root = this.tree.getRootNode();
    for(var id in this.tree.nodeHash) {
      var node = this.tree.nodeHash[id],
          recordId = this.extractRecordId(node);

      if(record.data[this.idField] == recordId) {
        node.remove();
        node.destroy();
      }
    }
  },
  onDataStoreUpdate: function(store, record, op) {
    if(op == Ext.data.Record.EDIT) {
      var changes = record.getChanges();
      if(changes[this.parentId] && !record.newBeforeSave) {
        // if it looks like a re-org, redraw everything
        var root = this.tree.getRootNode();
        this.reloadChildren(root);
      } else {
        // just update the local node
        for(var id in this.tree.nodeHash) {
          var node = this.tree.nodeHash[id],
              recordId = this.extractRecordId(node);

          if(record.data[this.idField] == recordId) {
            this.updateNode(node, record);
            return; // We found what we needed
          }
        }
        // It hasn't been created yet
        this.onDataStoreAdd(store, [record], null);
      }
    }
  },
  reloadChildren: function(node) {
    if(node.loading) {
      return;
    }

    node.childMap = node.childMap || {};
    node.loading = true;
    node.beginUpdate();

    var updated = {};
    var parentId = this.extractRecordId(node);
    var records = this.store.queryBy(function(record, id) {
      return (record.data && record.data[this.parentIdField] == parentId);
    }, this);

    for(var i=0;i<records.length;i++) {
      var r = records.items[i], child = node.childMap[r.id]; 
      if(child) {
        this.updateNode(child, r);
      } else {
        child = this.createChild(node, r);
      }
      updated[child.attributes.id] = true;

      // either preload or reload
      if(this.preloadChildren !== false || node.childNodes.length > 0) {
        this.reloadChildren(child);
      }
    }

    // Collect old children 
    var remove = [] ;
    node.eachChild(function(child) {
      if (!updated[child.attributes.id]) {
        remove.push(child);
      }
    });

    // Remove old children
    for(var i2=0;i2<remove.length;i2++) {
      // Normally remove would remove the rendering
      // too, but the method thinks it doesn't exist
      // because beginUpdate set childrenRendered = false
      remove[i2].remove();

      //Here is our cleanup
      remove[i2].ui.remove();
      remove[i2].destroy();
    }

    // endUpdate renders the children, we can't
    // do that we we haven't been rendered. The
    // only thing beginUpdate does is sets
    // childrenRendered = false, so we can leave
    // that hanging
    if(node.rendered) {
      node.endUpdate();
    }

    node.loading = false;
  },
  extractRecordId: function(node) {
    var parentId = null;
    if(node.attributes.record && node.attributes.record.data) {
      parentId = node.attributes.record.data[this.idField];
    }

    if(node.isRoot && !parentId) {
      parentId = null;
    }

    return parentId;
  },
  updateNode: function(node, record) {
    node.attributes.record = record;
    if(node.text != record.data[this.textField]) {
      node.setText(record.data[this.textField]);
    }
  },
  // Taken from Ext.tree.TreeLoader
  createChild : function(parent, record){
    var attr = {
      text: record.data[this.textField],
      record: record
    };

    if(this.qtipField && record.data[this.qtipField]) {
      attr.qtip = record.data[this.qtipField];
    }
  
    if(this.baseAttrs){
        Ext.applyIf(attr, this.baseAttrs);
    }
    if(typeof attr.uiProvider == 'string'){
       attr.uiProvider = this.uiProviders[attr.uiProvider] || eval(attr.uiProvider);
    }

    var child = new Ext.tree.TreeNode(attr)
    parent.appendChild(child);

    return child;
  }
};
