/*globals SWorks, Ext */

Ext.override(Ext.form.ComboBox, {
  getSelected: function() {
    var value = this.getValue();
    var index = this.store.find(this.valueField, value);

    if (index != -1) {
      return this.store.getAt(index);
    }
  },

  original_setValue: Ext.form.ComboBox.prototype.setValue,
  setValue: function(v) {
    if (v && v !== '') {
      this.original_setValue(v);
    } else {
      this.clearValue();
    }
  }
});

SWorks.CustomCombo = Ext.extend(Ext.form.ComboBox, {
  allowBlank: 'true',
  mode: 'local',
  typeAhead: true,
  emptyText:'Select one...',
  // valueNotFoundText is a problem if not for our custom
  // setValue in ComboBox
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
        this.on('blur', this.syncValue, this, {single: true});
      } else {
        this.setValue(this.value);
      }
    }
  }
});
Ext.reg('customcombo', SWorks.CustomCombo);

SWorks.EditableCombo = Ext.extend(Ext.util.Observable, {
  init: function(comp) {
    comp.addEvents('edit');
    comp.on('render', this.afterRender, this);
  },
  afterRender: function(comp) {
    var btn = Ext.DomHelper.append(comp.wrap, {
      tag: 'img',
      src:'../images/application_form_edit.png',
      style:'position:absolute;cursor:pointer;top:3.5px;margin-left:20px'
    }, true);
    btn.on('click', function() { comp.fireEvent('edit', comp); });
  }
});

SWorks.SearchCombo = Ext.extend(SWorks.CustomCombo, {
  // select only the displayField and valueFields 
  // use a querySet
  mode: 'remote',
  triggerAction: 'query',
  typeAhead: false,
  loadingText: 'Searching...',
  queryParam: 'q',
  pageSize: 0,

  initComponent: function() {
    SWorks.SearchCombo.superclass.initComponent.call(this);
    this.on('beforequery', this.mangleQuery, this);
    this.store.baseParams = this.store.baseParams || {};
    // Ferret will only return a few columns regardless, if you need the whole
    // record, you'll need to fetch it
    this.store.baseParams.select = [ this.displayField, this.valueField ].join(',');
  },

  mangleQuery: function(qData) {
    qData.query = this.displayField + ':' + qData.query + '*';
  },

  bindStore: function(store, initial) {
    if (store.mirrorSource) {
      console.error('SearchCombo must use a SearchStore');
    }

    SWorks.SearchCombo.superclass.bindStore.call(this, store, initial);
  },

  loadEmbeddedValue: function(v) {
    if (this.form && this.form.record) {

      var field = this.dataIndex.replace(this.valueField, this.displayField);
      var idField = this.store.reader.meta.id
      var data = this.form.record.json && this.form.record.data;

      if (data && data[field] && this.valueField == idField) {
        var record = {}
        record[this.valueField] = v;
        record[this.displayField] = data[field];
        record = new this.store.recordType(record, v);

        this.store.add(record, v);
        return true;
      }
    }

    return false;
  },

  loadServerValue: function(v) {
    this.store.load({
      add: true,
      params: {
        q: this.valueField + ':' + v,
      },
      // syncValue doesn't get triggered on this
      // because of add:true.
      scope: this,
      callback: function() {
        SWorks.SearchCombo.superclass.setValue.call(this, v);
      }
    });

    var text = this.loadingText;

    // This sets this.value = text, so we need to fix
    // this.value after the call.
    Ext.form.ComboBox.superclass.setValue.call(this, text);

    this.lastSelectionText = text;
    this.value = v;
    if(this.hiddenField) {
        this.hiddenField.value = v;
    }
  },

  setValue: function(v) {
    if (v && v !== '' &&
        this.valueField &&
        !this.findRecord(this.valueField, v) &&
        !this.loadEmbeddedValue(v)) {
      this.loadServerValue(v);
    } else {
      SWorks.SearchCombo.superclass.setValue.call(this, v);
    }
  }
});
Ext.reg('searchcombo', SWorks.SearchCombo);
