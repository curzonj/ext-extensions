/*globals SWorks, Ext */

SWorks.CustomCombo = Ext.extend(Ext.form.ComboBox, {
  allowBlank: 'true',
  mode: 'local',
  typeAhead: true,
  emptyText:'Select one...',
  // this valueNotFoundText may cause problems, I'm not sure
  valueNotFoundText: "Item not found",
  selectOnFocus:true,
  forceSelection: true,
  triggerAction: 'all',
  lazyInit: false,

  //They don't clear the store when you load the form,
  //so if the combo got left filtered, you can't get the right
  //value in there.
  findRecord: function(prop, value) {
    var record = null,
        data = this.store.filteredCache ||
               this.store.snapshot ||
               this.store.data;

    data.each(function(r){
      if(r.data[prop] == value){
        record = r;
        return false;
      }
    });
    return record;
  }, 
  beforeBlur: function() {
    SWorks.CustomCombo.superclass.beforeBlur.call(this);
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
          this.setRawValue(this.lastSelectionText);
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
    if(this.store && !initial) {
      this.store.un('update', this.onStoreUpdate, this);
      this.store.un('remove', this.onStoreRemove, this);
      this.store.un('datachanged', this.onStoreLoad, this);
    }

    SWorks.CustomCombo.superclass.bindStore.call(this, store, initial);

    if(store) {
      this.store.on('update', this.onStoreUpdate, this);
      this.store.on('remove', this.onStoreRemove, this);
      this.store.on('datachanged', this.onStoreLoad, this);
    }
  },
  //This keeps everything kosher if the data changes.
  //don't change anything if they are in the middle of selecting something
  onStoreLoad: function() {
    this.syncValue();
  },
  onStoreRemove: function(store, record) {
    if(this.valueField && !this.hasFocus &&
        record[this.valueField] == this.value) {

      this.syncValue();
    }
  },
  onStoreUpdate: function(store, record, type) {
    if(this.valueField && !this.hasFocus && type ==  Ext.data.Record.COMMIT &&
        record[this.valueField] == this.value) {

      this.syncValue();
    }
  },
  syncValue: function() {
    if(this.valueField) {
      if(this.hasFocus) {
        this.on('blur', function() {
          this.setValue(this.getValue());
        }, this, {single: true});
      } else {
        this.setValue(this.value);
      }
    }
  }
});
Ext.reg('customcombo', SWorks.CustomCombo);
