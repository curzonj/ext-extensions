var DDBulkMultiselect = function(config) {
  config.treeConfig = config.treeConfig || {}
  Ext.applyIf(config.treeConfig, {
    animate: true,
    autoScroll: true,
    enableDD:true,
    containerScroll:true
  });

  var multiselect = this;
  Ext.applyIf(config, {
    //required: store, dataIndex, name
    displayField: 'display_name',
    valueField: 'id',
    layout: 'column',
    border: false,
    defaults: {
      style: "margin:10px",
      columnWidth: .5,
      height: config.height
    },
    items: [
      this.srcTree = new Ext.tree.TreePanel(config.treeConfig),
      this.dstTree = new Ext.tree.TreePanel(config.treeConfig),
      this.hiddenField = new Ext.form.Hidden({
        name: config.name,
        dataIndex: config.dataIndex,
        setValue: function(v) {
          if(typeof v !== 'object') {
            v = []
          }
          this.value = v;
          this.setDomValue();

          multiselect.rebuildTrees();
        },
        getValue: function() {
          return this.value;
        },
        removeItem: function(v) {
          this.value.remove(v);

          this.setDomValue();
        },
        addItem: function(v) {
          this.value.push(v);

          this.setDomValue();
        },
        setDomValue: function() {
          if(this.rendered){
            var v = this.value.join(',');
            this.el.dom.value = (v === null || v === undefined ? '' : v);
            this.validate();
          }
        }
      })
    ]
  });
  delete config.height;

  DDBulkMultiselect.superclass.constructor.call(this, config);
}
Ext.extend(DDBulkMultiselect, Ext.Panel, {
  initComponent: function() {
    DDBulkMultiselect.superclass.initComponent.call(this);

    this.setupTrees();

    this.dstTree.on('remove', this.onRemove, this);
    this.dstTree.on('append', this.onAddItem, this);
    this.dstTree.on('insert', this.onAddItem, this);
    this.store.on('datachanged', this.rebuildTrees, this);

    this.rebuildTrees();
  },
  onRemove: function(tree, parent, node, index) {
    this.hiddenField.removeItem(node.attributes.value || node.id);
  },
  onAddItem: function(tree, parent, node) {
    this.hiddenField.addItem(node.attributes.value || node.id);
  },
  setupTrees: function() {
    new Ext.tree.TreeSorter(this.srcTree);
    new Ext.tree.TreeSorter(this.dstTree);

    this.srcTree.setRootNode(new JsonTreeNode({
      text: this.srcText,
      expanded: true,
      leaf: false
    }));
    this.dstTree.setRootNode(new JsonTreeNode({
      text: this.dstText,
      expanded: true,
      leaf: false
    }));
  },
  rebuildTrees: function() {
    var nodeValueArray = this.hiddenField.value || [];
    if(this.hiddenField) {
      this.hiddenField.value = [];
    }

    var srcRoot = this.srcTree.getRootNode();
    srcRoot.destroyChildren();

    var dstRoot = this.dstTree.getRootNode();
    dstRoot.destroyChildren();

    // TODO use this to create a proper tree in the source
    var missingParentFilter = function(r) {
      return (!r.data.parent_id || r.data.parent_id == "");
    }

    // I'm not sure what to query, if this were used without
    // our persistent filters
    var records = this.store.data.filterBy(function(r) { return true; });

    records.each(function(r) {
      var pos = nodeValueArray.indexOf(r.data[this.valueField]);
      if(pos == -1) {
        this.appendNode(srcRoot, r);
      } else {
        this.appendNode(dstRoot, r);
      }
    }, this);

    if(this.rendered) {
      dstRoot.expand();
      srcRoot.expand();
    }
  },
  appendNode: function(node, r) {
    node.appendChild(new Ext.tree.TreeNode({
      text: r.data[this.displayField],
      value: r.data[this.valueField],
      record: r,
      leaf: true
    }));
  }
});
