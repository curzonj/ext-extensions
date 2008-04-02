/*globals SWorks, Ext */

SWorks.BaseController = function(overrides) {
  Ext.apply(this, overrides);
}
Ext.extend(SWorks.BaseController, Ext.util.Observable, {
  init: function(comp) {
    this.component = comp;
    comp.controller = this;

    if(comp.store && !this.dataModel) {
      this.dataModel = new SWorks.StoreDataModel(comp.store);
    }

    if(comp.editor) {
      this.editor = comp.editor;
      delete comp.editor;

      if (!this.editor.doLayout) {
        this.editor = new SWorks.EditorDialog(this.editor, this);
      }
    }

    if(this.component.topToolbar && this.toolbarMgr !== false) {
      this.toolbarMgr = new (this.toolbarMgr || SWorks.CrudToolbarMgr)(this.component.topToolbar, this);
      this.component.topToolbar = this.toolbarMgr.getToolbar();
    }

    /* TODO 
     *   parent management
     *   grid.loadRecord?
     */ 

    comp.on('render', this.onRender, this);
  },

  onRender: function(comp) {
    this.initEvents(this.component);
  },

  initEvents: Ext.emptyFn,

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

  loadRecord: function() {
    var form = this.editor.getRenderedForm();

    // What about my panel 3rd arg?
    if(this.dataModel.loadForm(form, record)) {
      this.editor. ??

    }
  },

  saveForm: function(form, o) {
    if( this.isReadOnly(form.record) ) {
      return;
    }

    this.dataModel.saveForm(form, o);
  },

  createRecord: function() {
    var r = this.dataModel.newRecord();
    this.editRecord(r);
  },

  editRecord: function(record) {
    this.editor.loadRecord(record);
  }

});

SWorks.GridController = Ext.extend(SWorks.BaseController, {

  onRender: function(comp) {
    SWorks.GridController.superclass.onRender.call(this);

    this.component.store.load();
  },

  initEvents: function(c) {
    SWorks.GridController.superclass.initEvents.call(this);

  },

  getCurrentRecord: function() {
    return this.component.getSelections()[0];

    /* Extend this and replace with tree code
     *
     * var selModel = this.getSelectionModel();
    var node = selModel.getSelectedNode();
    if (node) {
      return node.attributes.record;
    } */ 
  }

});




