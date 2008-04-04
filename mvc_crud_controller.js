/*globals SWorks, Ext */

SWorks.BaseController = function(overrides) {
  this.forms = new Ext.util.MixedCollection();
  this.addEvents( 'ready',
                  'beforeaction', 'actionfailed', 'actioncomplete',
                  'beforeload', 'load', 'delete', 'save');

  Ext.apply(this, overrides);
};
Ext.extend(SWorks.BaseController, Ext.util.Observable, {
  init: function(comp) {
    this.component = comp;
    comp.controller = this;

    if (!(this.dataModel instanceof SWorks.DataModel)) {
      this.dataModel = this.dataModel || {};
      Ext.applyIf(this.dataModel, {
        store: comp.store,
        foreignKey: comp.foreignKey
      });

      this.dataModel = new SWorks.StoreDataModel(this.dataModel);
      this.relayEvents(this.dataModel, ['beforeload', 'load', 'delete', 'save']);
    }

    if(comp.editor) {
      this.editor = SWorks.EditorFactory.create(comp.editor, this);
      delete comp.editor;
    }

    if(this.component.topToolbar && this.toolbarMgr !== false) {
      var Type = this.toolbarMgr || SWorks.CrudToolbarMgr;
      this.toolbarMgr = new Type(this.component.topToolbar, this);

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

  saveForm: function(form, o) {
    if( this.isReadOnly(form.record) ) {
      return;
    }

    this.dataModel.saveForm(form, o);
  },

  initForm: function(form) {
    if (!this.forms.contains(form)) {
      this.forms.add(form);

      this.relayEvents(form, ['beforeaction', 'actionfailed', 'actioncomplete']);
      var index = new Ext.ux.data.CollectionIndex(form.items,
        function(o) {
          return o.dataIndex;
        }
      );
      form.fields = index.map;
    }
  },

  createRecord: function() {
    var r = this.dataModel.newRecord();
    this.loadRecord(r);
  },

  loadRecord: function(record) {
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




