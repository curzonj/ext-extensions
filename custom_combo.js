/*globals SWorks, Ext */

SWorks.CustomCombo = Ext.extend(Ext.form.ComboBox, {
  allowBlank: 'true',
  mode: 'local',
  typeAhead: true,
  emptyText:'Select one...',
  // valueNotFoundText is a problem if not for our custom setValue
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
  },
  setValue: function(v) {
    if (v && v !== '') {
      SWorks.CustomCombo.superclass.setValue.call(this, v);
    } else {
      this.clearValue();
    }
  }
});
Ext.reg('customcombo', SWorks.CustomCombo);

SWorks.EditableCombo = Ext.extend(SWorks.CustomCombo, {
  initComponent: function() {
    SWorks.EditableCombo.superclass.initComponent.call(this);
    this.addEvents('edit');
  },
  afterRender: function() {
    SWorks.EditableCombo.superclass.afterRender.call(this);
    var btn = Ext.DomHelper.append(this.wrap, {
      tag: 'img',
      src:'../images/application_form_edit.png',
      style:'position:absolute;cursor:pointer;top:3.5px;margin-left:20px'
    }, true);
    btn.on('click', function() { this.fireEvent('edit', this); }, this);
  }
});
Ext.reg('editablecombo', SWorks.EditableCombo);

SWorks.SearchCombo = Ext.extend(Ext.form.ComboBox, {
  // select only the displayField and valueFields 
  // use a querySet
  typeAhead: false,
  allowBlank: true,
  emptyText: 'Select one...',
  // valueNotFoundText is a problem if not for our custom setValue
  valueNotFoundText: "Item not found",
  selectOnFocus:true,
  forceSelection: true,
  lazyInit: false,
  loadingText: 'Searching...',
  queryParam: 'q',
  pageSize: 0,

  initComponent: function() {
    SWorks.SearchCombo.superclass.initComponent.call(this);
    this.on('beforequery', this.mangleQuery, this);
    this.store.baseParams = this.store.baseParams || {};
    this.store.baseParams.select = [ this.displayField, this.valueField ].join(',');
  },

  mangleQuery: function(qData) {
    qData.query = this.displayField + ':' + qData.query + '*';
  },

  findRecord: function(prop, value) {
    var r = SWorks.SearchCombo.superclass.findRecord.call(this, prop, value);
    if (!r) {
    } else {
      return r;
    }
  },

  // copy the beforeBlur features
  setValue : function(v, stopLoop) {
    if (v && v !== '') {
      var text = v;
      if(this.valueField){
          var r = this.findRecord(this.valueField, v);
          if(r){
              text = r.data[this.displayField];
          } else {
            var prop = this.valueField;

            if(!stopLoop) {
              this.store.load({
                params: { q: prop+':'+v },
                add: true,
                scope: this,
                callback: function(rArr, opts, succ) {
                  this.setValue(v, true);
                }
              });
            }

            if(this.valueNotFoundText !== undefined){
              text = this.valueNotFoundText;
            }
          }
      }
      this.lastSelectionText = text;
      if(this.hiddenField){
          this.hiddenField.value = v;
      }
      Ext.form.ComboBox.superclass.setValue.call(this, text);
      this.value = v;
    } else {
      this.clearValue();
    }
  }
});
Ext.reg('searchcombo', SWorks.SearchCombo);
