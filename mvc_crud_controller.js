/*globals SWorks, Ext */

Ext.namespace("SWorks");

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
      controller: this,
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

  getParent: function() {
    if(typeof this.parent == 'undefined') {
      this.parent = this.component.findParentBy(function(c) {
        return (typeof c.controller != 'undefined');
      });
    }

    return this.parent;
  },

  isReadOnly: function() {
    var res = !SWorks.CurrentUser.has(this.rwPerm);
    // TODO check permissions
/*    if (this.parent) {
      res = (res || this.parent.isReadOnly());
    } */
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

      var index = new Ext.ux.data.CollectionIndex(form.items, 'dataIndex',
        function(o) {
          return o.dataIndex;
        }
      );
      form.fields = index.map;
    }
  },

  createRecord: function() {
    var p = this.getParent();

    if (this.component.foreignKey && p &&
        p.form.isDirty()) {

      p.controller.saveForm(p.form, {
        callback: this.createRecord,
        scope: this
      });
    } else {
      var r = this.dataModel.newRecord();
      this.loadRecord(r);
    }
  },

  loadRecord: function(record) {
    this.editor.loadRecord(record);
  }

});

SWorks.GridController = Ext.extend(SWorks.BaseController, {

  onRender: function(comp) {
    SWorks.GridController.superclass.onRender.call(this);

    if(comp.foreignKey && this.getParent()) {
      this.checkParentColumns(comp.foreignKey);
      this.linkToParent();
    }
    this.component.store.load();
  },

  checkParentColumns: function(idCol) {
    if(idCol) {
      this.parentIdColumn = idCol;

      var column = idCol.replace(/id/, "type");
      var value = (this.dataModel.recordType.prototype.fields.keys.indexOf(column) != -1);

      if(value) {
        this.parentTypeColumn = idCol.replace(/id/, "type");
      } else {
        this.parentTypeColumn = null;
      }
    }
  },
  linkToParent: function() {
    var p = this.getParent();

    p.controller.on('load', function(form, record) {
      if(!p.form || p.form == form) {
        this.setRecordRelation(p.form.record);
        this.component.store.addFilter(this.parentFilter, this);
      }
    }, this);
    p.controller.on('save', function(record) {
      if (record == p.form.record) {
        this.setRecordRelation(p.form.record);
      }
    }, this);
  },

  setRecordRelation: function(r) {
    if(r) {
      this.parentFilter.relation_id = r.id;
      //This deals with polymorphic relations
      this.parentFilter.relation_type = this.getParentRecordModel(r);
    }
  },

  getParentRecord: function() {
    this.getParent() ? this.getParent().form.record : null;
  },

  getParentRecordModel: function(r) {
    var p = this.getParent();
    r = r || this.getParentRecord();

    return (typeof r.store == 'object') ? r.store.klass :
              ( r.data.klass || ( (p && typeof p.store == 'object') ?
                 p.store.klass : ''));
  },

  parentFilter: function(record){
    var idMatch = (record.data[this.parentIdColumn] == this.parentFilter.relation_id);
    var typeMatch = true;

    //Provides automatic filtering on polymophic relations
    if(this.parentTypeColumn) {
      typeMatch = (record.data[this.parentTypeColumn] == this.parentFilter.relation_type);
    }

    return (idMatch && typeMatch);
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




