/*globals Ext */

/* This code fixes a bug on Radios */
Ext.override(Ext.form.BasicForm, {
    setValues : function(values) {
        if(values instanceof Array){
            for(var i = 0, len = values.length; i < len; i++){
                var v = values[i];
                var f = this.findField(v.id);
                if(f){
                    if ( f.getEl().dom.type == 'radio' ) {
                        var group = this.el.dom.elements[f.getName()];
                        for (var i2=0; i < group.length; i2++ ) {
                            if(group[i2].__ext_field) {
                                group[i2].__ext_field.setValue(group[i2].value == v);
                                if(this.trackResetOnLoad){
                                    group[i2].__ext_field.originalValue = group[i2].__ext_field.getValue();
                                }
                            }
                        }
                    }
                    else
                    {
                        f.setValue(v.value);
                        if(this.trackResetOnLoad){
                            f.originalValue = f.getValue();
                        }
                    }
                }
            }
        }else{
            var field, id;
            for(id in values){
                if(typeof values[id] != 'function' && (field = this.findField(id))){
                    if( field.getEl().dom.type == 'radio' ) {
                        var group2 = this.el.dom.elements[field.getName()];
                        for (var i3=0; i3 < group2.length; i3++ ) {
                            if(group2[i3].__ext_field) {
                                group2[i3].__ext_field.setValue(group2[i3].value == values[id]);
                                if(this.trackResetOnLoad){
                                    group2[i3].__ext_field.originalValue = group2[i3].__ext_field.getValue();
                                }
                            }
                        }
                    }
                    else
                    {
                        field.setValue(values[id]);
                        if(this.trackResetOnLoad){
                            field.originalValue = field.getValue();
                        }
                    }
                }
            }
        }
        return this;
    }
});

Ext.override(Ext.form.Radio, {
    onRender : function(ct, position) {
        Ext.form.Radio.superclass.onRender.call(this, ct, position);
        this.el.dom.__ext_field = this;
    },

    setValue : function(v) {
        if(v === true || v === 'true' || v == '1' || v === false || v === 'false' || v == '0') {

            // Select all radios of this group
            var radios = this.el.up('form').select('input[type=radio]');

            this.checked = (v === true || v === 'true' || v == '1');
            if(this.el && this.el.dom) {
                this.el.dom.checked = this.checked;
            }

            // When a radio il checked, all other radios with the same name are unchecked automatically by
            // the browser, so the DOM part is done. Now we must set checked = false on the Ext object
            // and fire the "check" (false) event with the correct parameters
            // This cycles over all the radios...
            for(var i = 0; i < radios.elements.length; i++) {
                if(radios.elements[i].__ext_field && radios.elements[i].__ext_field != this && radios.elements[i].name == this.el.dom.name && radios.elements[i].__ext_field.el.dom.checked === false)
                {
                    radios.elements[i].__ext_field.checked = false;
                    radios.elements[i].__ext_field.fireEvent("check", radios.elements[i].__ext_field, false);
                }
            }

            // Lastly, we must fire the "check" (true) event on the selected radio
            this.fireEvent("check", this, this.checked);
        }
    }
});

//Ext.form.Field.onBlur calls beforeBlur too
Ext.override(Ext.form.TriggerField, {
  triggerBlur : function(){
    this.mimicing = false;
    Ext.get(Ext.isIE ? document.body : document).un("mousedown", this.mimicBlur);
    if(this.monitorTab){
      this.el.un("keydown", this.checkTab, this);
    }
    Ext.form.TriggerField.superclass.onBlur.call(this);
  },

  beforeBlur : function() {
    Ext.form.TriggerField.superclass.beforeBlur.call(this);

    this.wrap.removeClass('x-trigger-wrap-focus');
  }
});

Ext.override(Ext.DataView, {
  // The default implementation is always giving me errors
  // about updating elements that don't exist
  onUpdate: function(ds, record) {
    this.refresh();
  }
});

Ext.override(Ext.data.GroupingStore, {
   applySort : function(){
        Ext.data.GroupingStore.superclass.applySort.call(this);
        if(!this.groupOnSort && !this.remoteGroup){
            var gs = this.getGroupState();
            if(gs && (!this.sortInfo || gs != this.sortInfo.field)){
                this.sortData(this.groupField);
            }
        }
    }
});

Ext.override(Ext.tree.TreeNodeUI, {
  collapse: function() {
    this.updateExpandIcon();
    // There is a bug where the code below
    // is called when not rendered. Line 22946
    if(this.rendered) {
      this.ctNode.style.display = "none";
    }
  }
});

// The removeMask feature is busted by default
Ext.override(Ext.LoadMask, {
  onLoad: function() {
    this.el.unmask();
    if(this.removeMask) {
      this.destroy();
    }
  }
});

Ext.override(Ext.form.ComboBox, {
  clearValue : function(){
    if(this.hiddenField){
        this.hiddenField.value = '';
    }
    //By default if you call clearValue, then getValue, it
    //will return the previous value
    this.value = null;
    this.setRawValue('');
    this.lastSelectionText = '';
    this.applyEmptyText();
  },
  onDisable: function(){
    // this.disabled isn't set until AFTER this method is called,
    // so the default implementation is just wacked
    Ext.form.ComboBox.superclass.onDisable.apply(this, arguments);
    if(this.hiddenField){
      this.hiddenField.disabled = true;
    }
  },
  onEnable: function() {
    // This is entirely missing
    Ext.form.ComboBox.superclass.onEnable.apply(this, arguments);
    if(this.hiddenField) {
      this.hiddenField.disabled = false;
    }
  }
});

Ext.override(Ext.data.Store, {
  onMetaChange: function(meta, rtype, o) {
    this.recordType = rtype;
    this.fields = rtype.prototype.fields;
    delete this.snapshot;
    if(meta.sortInfo) {
      // Only change the sortInfo if it is provided, this
      // allows the server to choose not to affect the any
      // sort applied by the user
      this.sortInfo = meta.sortInfo;
    }
    this.modified = [];
    this.fireEvent('metachange', this, this.reader.meta);
  },
  insert: function(index, records) {
    records = [].concat(records);
    for(var i = 0, len = records.length; i < len; i++){
      this.data.insert(index, records[i]);
      records[i].join(this);
    }
    if(this.snapshot){ //This was missing
     this.snapshot.addAll(records);
    }
    this.fireEvent("add", this, records, index);
  }
});
