/*globals SWorks, Ext */

SWorks.CrudController = function(overrides) {
  Ext.apply(this, overrides);
}
Ext.extend(SWorks.CrudController, Ext.util.Observable, {
  init: function(comp) {
    this.component = comp;

    if(comp.store && !this.dataModel) {
      this.dataModel = new SWorks.StoreDataModel(comp.store);
    }

    if(this.editor && !this.editor.doLayout) {
      this.editor = new SWorks.EditorDialog(this.editor, this);
    }

    if(this.component.topToolbar && this.toolbarMgr !== false) {
      this.tbMgr = new (this.toolbarMgr || SWorks.CrudToolbarMgr)(this.component.topToolbar, this);
      this.component.topToolbar = this.tbMgr.getToolbar();
    }

    /* TODO 
     *   parent management
     *   grid.loadRecord?
     */ 

    comp.on('render', this.onRender, this);
  },

  onRender: function(comp) {
    this.component.store.load();
    this.initEvents(this.component);
  },

  initEvents: function(c) {

  },

  setParent: function(p) {
    this.parent = p;
  },

  isReadOnly: function() {
    var res = !SWorks.CurrentUser.has(this.rwPerm);
    // TODO check permissions
    if (this.parent) {
      res = (res || this.parent.isReadOnly());
    }
    return res;
  },

  getCurrentRecord: function() {
    return this.getSelections()[0];

    /* Extend this and replace with tree code
     *
     * var selModel = this.getSelectionModel();
    var node = selModel.getSelectedNode();
    if (node) {
      return node.attributes.record;
    } */ 
  },

  createRecord: function() {
    var r = this.dataModel.newRecord();
    this.editRecord(r);
  },

  editRecord: function(record) {

  }
});




