/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks.plugins');

SWorks.plugins.LinkedToParent = Ext.extend(SWorks.AbstractController, {
  buildDataModel: function(comp) {
    return new SWorks.URLLoadingDataModel({
      foreignKey: comp.foreignKey,
      parentKey: comp.parentKey || 'id',
      controller: this,
      store: comp.store
    });
  },
  afterRender: function() {
    this.parent.on('beforeload', this.onBeforeLoad, this);
  },
  onBeforeLoad: function(form, record) {
    this.dataModel.loadFromRecord(record);
  }
});

SWorks.plugins.URLLoadingStore = Ext.extend(SWorks.AbstractController, {
  buildDataModel: function(comp) {
    return new SWorks.URLLoadingDataModel({
      foreignKey: comp.foreignKey,
      parentKey: comp.parentKey || 'id',
      controller: this,
      store: comp.store
    });
  },
  init: function(comp) {
    SWorks.plugins.URLLoadingStore.superclass.init.apply(this, arguments);

    comp.loadFromRecord = 
             this.dataModel.loadFromRecord.createDelegate(this.dataModel);
  }
});
