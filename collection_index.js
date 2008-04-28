/*globals Ext */

Ext.namespace('Ext.ux.data');

Ext.ux.data.CollectionIndex = function(coll, name, fn) {
  if(typeof name == 'function') {
    fn = name;
    name = null;
  }

  this.collection = coll;
  this.mapFn = fn;
  this.map = {};

  if(name) {
    coll.maps = coll.maps || {};
    coll.maps[name] = this.map;
  }

  coll.on('add', this.onAdd, this);
  coll.on('replace', this.onReplace, this);
  coll.on('remove', this.onRemove, this);
  coll.on('clear', this.onClear, this);

  this.refreshIndex();
};

Ext.ux.data.CollectionIndex.prototype = {
  onAdd: function(index, o, key) { this.index(o); },
  onReplace: function(key, old, o) { this.index(o); },
  index: function(o) {
    var key = this.mapFn(o);
    if(key) {
      this.map[key] = o;
    }
  },
  refreshIndex: function() {
    this.collection.each(function(item) {
      this.index(item);
    }, this);
  },

  onRemove: function(o, key) {
    key = this.mapFn(o);
    if(key) {
      delete this.map[key];
    }
  },
  onClear: function() {
    this.map = {};
  }
};

Ext.override(Ext.FormPanel, {
  createForm_without_collection_index: Ext.FormPanel.prototype.createForm,
  createForm: function() {
    var form = this.createForm_without_collection_index();
    var index = new Ext.ux.data.CollectionIndex(form.items,
      function(o) {
        return o.dataIndex;
      }
    );
    form.fields = index.map;

    return form;
  }
});
