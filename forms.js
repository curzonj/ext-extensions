Ext.override(Ext.form.BasicForm, {
  initComponent_without_features: Ext.form.BasicForm.prototype.initComponent,
  initComponent: function() {
    this.initComponent_without_features();

    this.addEvents({
      load: true
    });
  },
  onRecordUpdate: function(store, record, type) {
    if(this.record &&
       this.record.id == record.id &&
       type == Ext.data.Record.EDIT) {
      this.setValues(record.getChanges());
    }
  },
  loadRecord: function(record) {
    this.setValues(record.data);
    this.record = record;

    // If our record changes, adjust ourselves
    if(!this._onRecordUpdateLoaded && record.store) {
      this._onRecordUpdateLoaded = true;
      record.store.on('update', this.onRecordUpdate, this);
    }

    this.fireEvent('load', this, record);

    return this;
  },
  getRecord: function() {
    if(!this.record)
      return;

    if(!this.record.newRecord) {
      // Sometimes our store gets reloaded in between
      // and we throw errors if we use old records
     this.record = this.record.store.getById(this.record.id);
    }
    return this.record;
  }
});
