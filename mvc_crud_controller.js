/*globals SWorks, Ext */

Ext.namespace("SWorks");

// Anything that inherits directly from AbstractController
// is pretty custom. The sky is the limit on what it can do.
SWorks.AbstractController = function() {
  // The controllers don't take overrides to prohibit customizing it
  // inside the grid definition. Controllers should always have a class
  // definition if it needs anything
  this.forms = new Ext.util.MixedCollection();
  this.addEvents( 'beforeaction', 'actionfailed', 'actioncomplete',
                  'beforeload', 'load', 'delete', 'save');
};
Ext.extend(SWorks.AbstractController, Ext.util.Observable, {
  toolbarMgrClass: SWorks.CrudToolbarMgr,

  init: function(comp) {
    this.component = comp;
    comp.controller = this;

    this.dataModel = this.buildDataModel(comp);
    if(this.dataModel) {
      this.relayEvents(this.dataModel, ['beforeload', 'load', 'delete', 'save']);
      this.on('load', this.onLoadForm, this);
    }

    this.editor = this.buildEditor(comp);
    if(this.editor) {
      this.editor.controller = this;
    }

    if(comp.topToolbar) {
      this.toolbarMgr = new this.toolbarMgrClass(comp.topToolbar, this);
      comp.topToolbar = this.toolbarMgr.getToolbar();
    }

    comp.on('render', this.onRender, this);
  },

  buildDataModel: Ext.emptyFn,
  buildEditor: function(comp) {
    var config = comp.editor;

    if (config && typeof config.loadRecord != 'function') {
      if(config instanceof Array) {
        config = { items: config };
      } else if (config.xtype == 'form') {
        config = {
          items: [
            config
          ]
        };
      }

      config = new SWorks.DialogEditor(config);
      delete comp.editor;
    }

    return config;
  },

  onLoadForm: Ext.emptyFn,

  onRender: function(comp) {
    this.findParentComponent();

    this.afterRender();
  },
  afterRender: Ext.emptyFn,

  isReadOnly: function(form) {
    var res = !SWorks.CurrentUser.has(this.rwPerm);
    if (this.parent) {
      res = (res || this.parent.isReadOnly(this.parentForm));
    }
    return res;
  },

  saveForm: function(form, o) {
    if( this.isReadOnly(form.record) ) {
      return;
    }

    this.dataModel.saveForm(form, o);
  },

  initFormIdempotent: function(form, panel) {
    if (!this.forms.contains(form)) {
      this.forms.add(form);

      panel.controller = this;
      this.relayEvents(form, ['beforeaction', 'actionfailed', 'actioncomplete']);

      if(form.items.length < 1) {
        console.error('Form is missing fields');
      }

      var index = new Ext.ux.data.CollectionIndex(form.items, 'dataIndex',
        function(o) {
          return o.dataIndex;
        }
      );
      form.fields = index.map;

      for (var name in index.map) {
        index.map[name].form = form;
      }

      this.initForm(form, panel);
    }
  },

  initForm: Ext.emptyFn,

  createRecord: function() {
    if (this.parentForm && this.parentForm.isDirty()) {
      this.parent.saveForm(this.parentForm, {
        callback: this.createRecord.createDelegate(this, arguments)
      });
    } else {
      var r = this.dataModel.newRecord.apply(this.dataModel, arguments);

      this.setDefaults(r);
      this.loadRecord(r);
    }
  },
  setDefaults: Ext.emptyFn,

  loadRecord: function(record) {
    this.onLoadRecord(record);
  },

  onLoadRecord: function(record) {
    this.editor.loadRecord(record);
  },

  findParentComponent: function() {
    var pcomp = this.component.findParentBy(function(c) {
      return (typeof c.controller != 'undefined');
    });

    if(pcomp) {
      this.parent = pcomp.controller;
      this.parentForm = pcomp.form;
    }
  },

  ifConfirmRecord: function(phrase, fn, scope) {
    var r = this.getCurrentRecord();
    var name = r.data.text || 'this item';
    var msg = String.format(phrase, name);

    Ext.MessageBox.confirm('Confirm',
      'Do you really want to '+msg+'?', function(btn) {
        if (btn == 'yes') {
          fn.call(scope, r);
        }
      }, this);
  }
});

// To bridge parent/child relations between the two versions
SWorks.LegacyController = function() {
  this.addEvents( 'beforeaction', 'actionfailed', 'actioncomplete',
                  'beforeload', 'load', 'delete', 'save');
}
Ext.extend(SWorks.LegacyController, Ext.util.Observable, {
  init: function(comp) {
    this.component = comp;
    comp.controller = this;

    if (comp.editor) {
      this.editor = comp.editor;
      this.editor.controller = this;
    } else {
      // Can't be put as a plugin on editors, you need to use:
      // new SWorks.LegacyController().init(editor);
      // because the plugins property works on the editor panel,
      // not the editor
      this.editor = comp;
    }

    this.editor.on('render', this.wireEditor, this);
    this.relayEvents(this.editor, ['beforeaction', 'actionfailed', 'actioncomplete',
                  'beforeload', 'load', 'delete', 'save']);
  },
  wireEditor: function(panel) {
    // this helps deal with the tabbed crud editor
    panel.controller = this;
  },
  saveForm: function(form, opts) {
    this.editor.saveForm(form, opts);
  },
  isReadOnly: function(form) {
    if (form) {
      return this.editor.isReadOnly(form.record);
    } else {
      return this.component.isReadOnly();
    }
  }
});

SWorks.GridController = Ext.extend(SWorks.AbstractController, {

  buildDataModel: function(comp) {
    return new SWorks.StoreDataModel({
      controller: this,
      store: comp.store,
      foreignKey: comp.foreignKey
    });
  },

  onRender: function(comp) {
    SWorks.GridController.superclass.onRender.call(this, comp);

    comp.on('celldblclick', this.onGridCellDblClick, this);

    if(this.parent) {
      this.dataModel.linkToParent(this.parent, this.parentForm);
    } else {
      comp.store.load();
    }
  },

  onGridCellDblClick: function(grid, rowIndex, cellIndex, e) {
    var r = this.component.store.getAt(rowIndex);
    this.loadRecord(r);
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


SWorks.URLLoadingController = Ext.extend(SWorks.GridController, {
  buildDataModel: function(comp) {
    return new SWorks.URLLoadingDataModel({
      controller: this,
      store: comp.store,
      foreignKey: comp.foreignKey
    });
  }
});

SWorks.SearchGridController = Ext.extend(SWorks.GridController, {
  pageSize: 100,
  loadMask: true,

  init: function(comp) {
    SWorks.SearchGridController.superclass.init.apply(this, arguments);

    comp.elements += ',bbar';
    comp.bottomToolbar = new Ext.PagingToolbar({
      pageSize: this.pageSize,
      store: comp.store,
      displayInfo: true,
      displayMsg: 'Displaying items {0} - {1} of {2}',
      emptyMsg: "No items to display"
    });
  },

  buildDataModel: function(comp) {
    return new SWorks.FerretSearchDataModel({
      controller: this,
      store: comp.store,
      pageSize: this.pageSize,
      foreignKey: comp.foreignKey
    });
  },

  loadRecord: function(record) {
    if(record.newRecord) {
      this.onLoadRecord(record);
    } else {
      this.dataModel.fetchRecord(record.id, {
        callback: function(fullRecord) {
          this.onLoadRecord(fullRecord);
        },
        scope: this
      });
    }
  }

});


