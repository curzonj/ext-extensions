var CustomCombo = Ext.extend(Ext.form.ComboBox, {
  allowBlank: 'true',
  mode: 'local',
  typeAhead: true,
  emptyText:'Select one...',
  selectOnFocus:true,
  forceSelection: true,
  triggerAction: 'all',
  lazyInit: false,

/*  findRecord: function(prop, value) {
    var record = null,
        data = this.store.filteredCache ||
               this.store.data;

    data.each(function(r){
      if(r.data[prop] == value){
        record = r;
        return false;
      }
    });
    return record;
  }, */

  //They don't clear the store when you load the form,
  //so if the combo got left filtered, you can't get the right
  //value in there.
  setValue: function(v) {
    this.store.clearFilter();
    CustomCombo.superclass.setValue.call(this, v);
  },
  beforeBlur: function() {
    CustomCombo.superclass.beforeBlur.call(this);
    var text = this.getRawValue();
    
    if(this.rendered) {
      if(text.length < 1){
        //If you delete the value, that should clear the field
        if(this.hiddenField){
          this.hiddenField.value = '';
        }
        this.value = '';
        this.lastSelectionText = '';
      } else if(this.forceSelection && (text != this.lastSelectionText)) {
        // If the current value isn't checked yet
        var r = this.findRecord(this.displayField, text);
        if(!r) {
          //if we can't find the value they entered, don't
          //change the value, just restore the text
          this.setRawValue(this.lastSelectionText)
        } else {
          if(this.valueField) {
            //if setvalue wants the valueField
            this.setValue(r.data[this.valueField]);
          } else {
            // else it wants the displayField
            this.setValue(text);
          }
        }
      }
    }
  },
  bindStore: function(store, initial) {
    CustomCombo.superclass.bindStore.call(this, store, initial);

    if(this.store && !initial) {
      this.store.un('update', this.onStoreUpdate, this);
      this.store.un('datachanged', this.onStoreDataChanged, this);
    }

    if(store) {
      this.store.on('update', this.onStoreUpdate, this);
      this.store.on('datachanged', this.onStoreDataChanged, this);
    }
  },
  //This keeps everything kosher if the data changes
  onStoreDataChanged: function(store) {
    this.setValue(this.value);
  },
  onStoreUpdate: function(store, record, type) {
    if(type ==  Ext.data.Record.COMMIT &&
        record[(this.valueField || this.displayField)] == this.value) {

      this.setValue(this.value);
    }
  }
});
Ext.reg('customcombo', CustomCombo);
