/*globals SWorks, Ext */

SWorks.BaseController = function() {
  this.forms = new Ext.util.MixedCollection();
  this.addEvents( 'ready',
                  'beforeaction', 'actionfailed', 'actioncomplete',
                  'beforeload', 'load', 'delete', 'save');
};
Ext.extend(SWorks.BaseController, Ext.util.Observable, {
  dataModelClass: SWorks.StoreDataModel,
  toolbarMgrClass: SWorks.CrudToolbarMgr,
  editorClass: SWorks.DialogEditor,

  init: function(comp) {
    this.component = comp;
    comp.controller = this;

    this.dataModel = this.buildDataModel(comp);

    this.editor = this.buildEditor(comp);
    this.editor.controller = this;

    if(comp.topToolbar) {
      this.toolbarMgr = new this.toolbarMgrClass(comp.topToolbar, this);
      comp.topToolbar = this.toolbarMgr.getToolbar();
    }

    /* TODO 
     *   parent management
     *   grid.loadRecord?
     */ 

    comp.on('render', this.onRender, this);
  },

  buildEditor: function(comp) {
    var config = comp.editor;

    if (typeof config.loadRecord != 'function') {
      if(config instanceof Array) {
        config = { items: config };
      } else if (config.xtype == 'form') {
        config = {
          items: [
            config
          ]
        };
      }

      config = new this.editorClass(config);
      delete comp.editor;
    }

    return config;
  },

  buildDataModel: function(comp) {
    var dm = new this.dataModelClass({
      store: comp.store,
      foreignKey: comp.foreignKey
    });
    this.relayEvents(dm, ['beforeload', 'load', 'delete', 'save']);

    return dm;
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




