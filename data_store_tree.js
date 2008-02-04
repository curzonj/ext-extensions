/*globals Ext */

//required: store, textField; optional: idField, parentIdField, qtipField
Ext.ux.tree.DataStoreBacking = function(config) {
  Ext.apply(this, config);
}
Ext.ux.tree.DataStoreBacking.prototype = {
  idField: 'id',
  parentIdField: 'parent_id',

  init: function(tree) {
    this.tree = tree;

    this.tree.on('beforeexpandnode', this.onBeforeExpandNode, this);
    // TODO Link the tree to the loading mask of the data store

    if(this.keepUpdated !== false) {
      this.store.on('datachanged', this.onDataStoreChanged, this);
      this.store.on('add', this.onDataStoreAdd, this);
      this.store.on('remove', this.onDataStoreRemove, this);
      this.store.on('update', this.onDataStoreUpdate, this);
    }
  },
  // TODO make these more efficient
  onBeforeExpandNode: function(node, deep, anim) {
    if(!node.childNodes || node.childNodes.length === 0) {
      this.reloadChildren(node);
    }
  },
  onDataStoreChanged: function() {
    var root = this.tree.getRootNode();
    this.reloadChildren(root);
  },
  onDataStoreAdd: function() {
    var root = this.tree.getRootNode();
    this.reloadChildren(root);
  },
  onDataStoreRemove: function() {
    var root = this.tree.getRootNode();
    this.reloadChildren(root);
  },
  onDataStoreUpdate: function() {
    var root = this.tree.getRootNode();
    this.reloadChildren(root);
  },
  reloadChildren: function(node) {
    if(node.loading) {
      return;
    }

    node.loading = true;
    node.beginUpdate();

    var updated = {};
    var records = this.store.queryBy(
        this.parentMatch.createDelegate(this, [this.getParentId(node)], true));
    for(var i=0;i<records.length;i++) {
      var r = records.items[i];
      var child = node.findChildBy(this.nodeMatch.createDelegate(this, [r], true));

      if(child) {
        this.updateNode(child, r);
      } else {
        child = this.createNode(r);

        if(child) {
          node.appendChild(child);
        }
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
  nodeMatch: function(node, record) {
    return (node.attributes.record && node.attributes.record.id == record.id);
  },
  parentMatch: function(record, id, parentId) {
    return (record.data && record.data[this.parentIdField] == parentId);
  },
  getParentId: function(node) {
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
  createNode : function(record){
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
      return new Ext.tree.TreeNode(attr);
  }
}
