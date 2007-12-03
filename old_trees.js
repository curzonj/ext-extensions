// Currently only used on nav tree, to be replaced by DataStoreBacking
var DynamicTree = Ext.extend(Ext.tree.TreePanel, {
  rootVisible: false,
  animate: false,

  initComponent: function(){
    DynamicTree.superclass.initComponent.call(this);
    this.addEvents({
      load: true
    });

    var root = new JsonTreeNode({
      id: 'root',
      text: 'Root Node (invisible)'
    })
    this.setRootNode(root);
    if (this.initialData) {
      this.setChildren(this.initialData);
    } else if (this.url) {
      this.load();
    }
  },
  setChildren: function(children) {
    var root = this.getRootNode();
    root.destroyChildren();
    root.createChildren(children);
    this.fireEvent('load', this);
    if (this.rendered)
      root.renderChildren();
  },
  load: function(url) {
    // TODO loading mask
    Ext.Ajax.request({
      url: (url || this.url),
      success: function(response) {
        var data =  Ext.decode(response.responseText);
        this.setChildren(data);
      },
      scope: this
    });
  }
});

var JsonTreeNode = function(config) {
  config = config || {}
  Ext.applyIf(config, {leaf: (config.children == null)});
  JsonTreeNode.superclass.constructor.call(this, config);
  if (config.children)
    this.createChildren(config.children);
};
Ext.extend(JsonTreeNode, Ext.tree.TreeNode, {
  createChildren: function(children) {
    this.on('click', function() {
      this.toggle();
    }, this);
    for (var i=0; i<children.length; i++) {
      this.appendChild(new JsonTreeNode(children[i]));
    }
  },
  //Only called on root, destroy() does the rest
  destroyChildren: function() {
    while(this.firstChild) {
      var node = this.firstChild
      this.removeChild(node);
      if (node.destroy)
        node.destroy();
    }
  }
});
