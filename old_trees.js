// Currently only used on nav tree, to be replaced by DataStoreBacking
SWorks.DynamicTree = Ext.extend(Ext.tree.TreePanel, {
  rootVisible: false,
  animate: false,

  initComponent: function(){
    SWorks.DynamicTree.superclass.initComponent.call(this);
    this.addEvents({
      load: true
    });

    var root = new Ext.ux.JsonTreeNode({
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

