/*globals SWorks, Ext, ds */

SWorks.CrudController = function(overrides) {
  Ext.apply(this, overrides);
}
Ext.extend(SWorks.CrudController, Ext.util.Observable, {
  init: function(comp) {
    this.component = comp;

    if(comp.store && !this.dataModel) {
      this.dataModel = new SWorks.StoreDataModel(comp.store);
    }

    if(this.editor && !this.editor.doLayout) {
      this.editor = new SWorks.EditorDialog(this.editor, this);
    }

    if(this.component.topToolbar && this.toolbarBuilder !== false) {
      new (this.toolbarBuilder || SWorks.CrudToolbarBuilder)(this.component.topToolbar, this);
    }

    /* TODO 
     *   parent management
     *   grid.loadRecord?
     */ 

    comp.on('render', this.onRender, this);
  },

  onRender: function(comp) {
    this.component.store.load();
    this.initEvents(this.component);
  },

  initEvents: function(c) {

  },

  getCurrentRecord: function() {
    return this.getSelections()[0];

    /* Extend this and replace with tree code
     *
     * var selModel = this.getSelectionModel();
    var node = selModel.getSelectedNode();
    if (node) {
      return node.attributes.record;
    } */ 
  },

  createRecord: function() {
    var r = this.dataModel.newRecord();
    this.editRecord(r);
  },

  editRecord: function(record) {

  }
});

SWorks.CrudToolbarBuilder = function(tbar, controller) {
  this.tbar = tbar;
  this.controller = controller;
  /* TODO
   *   Wire toolbar buttons
   *   check toolbar buttons
   */
}
SWorks.CrudToolbarBuilder.prototype = {
  onClickAddBtn: function() {
    this.controller.createRecord();
  },
  onClickEditBtn: function() {
    var r = this.controller.getCurrentRecord();
    this.controller.editRecord(r);
  }
}

SWorks.EditorDialog = Ext.extend(Ext.Window, {});


SWorks.DataModel = function(overrides) {
  Ext.apply(this, overrides);
}
Ext.extend(SWorks.DataModel, Ext.util.Observable, {

  newRecord: function(data, initRecord) {
    var record = new this.recordType(data || {});
    record.id = 'new';
    record.newRecord = true;

    if(initRecord !== false) {
      var keys = record.fields.keys;
      for(var i = 0, len = keys.length; i < len; i++){
        if(typeof record.data[keys[i]] == "undefined") {
          record.data[keys[i]] = "";
        }
      }

      this.initializeRecord(record);
    }

    return record;
  },

  deleteRecord: function(record, cb, scope){
    this.deleteRecordById(record.id, cb, scope);
  },
  deleteRecordById: function(id, cb, scope){
    // TODO add a retry mechanism, use the spinner. The reason
    // the msgBox doesn't work is because this method is called
    // seperately for each record to delete
    if(this.restUrl) {
      Ext.Ajax.request({
        cb: {
          fn: cb,
          scope: scope || this
        },
        deleting_id: id,
        url: String.format(this.restUrl, id),
        method: "DELETE",
        callback: this.onDeleteById,
        scope: this
      });
    }
  },
  onDeleteById: function(options, success, response) {
    var result = null, id = options.deleting_id;
    if(success) {
      result =  Ext.decode(response.responseText);
    }

    if (success && result.success) {
      if(options.cb.fn) {
        options.cb.fn.call(options.cb.scope);
      }
      this.fireEvent('delete', id);
    } else {
      var msg = (result && result.msg ? result.msg : "Failed to delete the record. Please try again.");
      Ext.MessageBox.alert('Delete failed', msg);
    }

    return result;
  }

  saveRecord: function(o) {
    // Options: record, callback
    if(o.record && !o.record.data) {
      o.record = this.newRecord(o.record, false);
    }

    o = this.setUpdateOrCreate(o.record, o);
    Ext.applyIf(o.params, this.serializeRecord(o.record));

    this.postToRecord(o.record.id, o);
  },
  updateAttribute: function(options) {
    /* options:
     *   id: id of the record you want to update
     *   field: the model attribute to update
     *   value: the new value
     */

     var id = options.id || options.record.id;

     options.params = {
       '_method': 'put'
     };

     if(options.field) {
       var key = String.format(this.parameterTemplate, options.field);

       if(options.record && typeof options.value == 'undefined') {
         options.value = options.record.get(options.field);
       }
       options.params[key] =  options.value;
     }

     this.postToRecord(id, options);
  },
  setUpdateOrCreate: function(record, o) {
    o = o || {};
    o.params = o.params || {};
    
    if(record.newRecord) {
      Ext.applyIf(o, { url: this.createUrl});
      Ext.applyIf(o.params, { '_method': 'post'});
    } else {
      Ext.applyIf(o, { url: String.format(this.restUrl, record.id)});
      Ext.applyIf(o.params, { '_method': 'put'});
    }

    return o;
  },
  serializeRecord: function(record) {
    var values = {};
    var data = record.data || record;
    var fields = this.serializedFields || record.fields.keys;
    for(var i=0;i<fields.length;i++) {
      var key = String.format(this.parameterTemplate, fields[i]);
      var value = data[fields[i]];
      if(typeof value != "undefined" && fields[i] != 'id' && fields[i] != 'type') {
        values[key] = value;
      }
    }

    return values;
  },
  postToRecord: function(rid, o) {
    if(typeof rid == 'object') {
      o = rid;
      rid = o.id;
    } else if(typeof rid == 'undefined') {
      Ext.MessageBox.alert('Operation failed', "There was an internal error. Please report the issue and reload the application");
    }

    if(o.waitMsg !== false) {
      Ext.MessageBox.wait(o.waitMsg || "Updating Record...");
    }

    // TODO add a retry mechanism

    if(!o.url && o.record) {
      o = this.setUpdateOrCreate(o.record, o);
    } else {
      o.url = o.url || String.format(this.restUrl, rid);
    }

    o.errmsg = o.errmsg || "Failed update the record. Please try again.";
    o.cb = {
      fn: o.callback,
      scope: o.scope
    };

    Ext.Ajax.request(Ext.apply(o, {
      callback: this.postToRecordCallback,
      scope: this
    }));
  },
  postToRecordCallback: function(options, success, response) {
    if(options.waitMsg !== false) {
      Ext.MessageBox.updateProgress(1);
      Ext.MessageBox.hide();
    }

    var result = null;
    if(success) {
      result =  Ext.decode(response.responseText);
    }

    var record = options.record;
    if (success && result.success) {
      if(record) {
        if(record.store) {
          record = record.store.getById(record.id);
        }
        this.updateRecord(record, result);
      } else {
        record = new this.recordType(result.data, result.objectid);
      }
     
      if(options.cb.fn) { 
        options.cb.fn.call(options.cb.scope || this, true, record, result);
      }
      this.fireEvent('save', record, result);
      record.newBeforeSave = false;
    } else {
      if(options.cb.fn) { 
        options.cb.fn.call(options.cb.scope || this, false, record, result);
      }

      var msg = ((result && result.errors) ? (result.errors.base || options.errmsg) : options.errmsg);
      Ext.MessageBox.alert('Operation failed', msg);
    }
  },


});

SWorks.GridScrollSaver = function() {}
SWorks.GridScrollSaver.prototype = {
  init: function(comp) {
    comp.on('afterrender', function() {
      comp.container.on('afterlayout', function() {
        if(comp.savedScrollPos && comp.view) {
          comp.view.scroller.scrollTo('top', comp.savedScrollPos);
        }
      }, comp);
    }, comp);
    comp.on('bodyscroll', function(y, x) {
      comp.savedScrollPos = x;
    });
    comp.on('show', function() {
      if(comp.savedScrollPos && comp.view) {
        comp.view.scroller.scrollTo('top', comp.savedScrollPos);
      }
    });
  }
}

SWorks.CustomGrid = Ext.extend(Ext.grid.GridPanel, {
  autoSizeColumns: true,
  minColumnWidth: 5,

  initComponent: function() {
    SWorks.CustomGrid.superclass.initComponent.call(this);

    this.colModel.defaultSortable = true;

    new SWorks.GridScrollSaver().init(this);
  },
  loadMask: { removeMask: true },
  getView: function() {
    if(!this.view) {
      if(this.store.groupBy) {
        this.view = new Ext.grid.GroupingView(Ext.apply({
          forceFit:true,
          enableNoGroups: true,
          hideGroupedColumn: true,
          groupTextTpl: '{text} ({[values.rs.length]} {[values.rs.length > 1 ? "Items" : "Item"]})'
        }, this.viewConfig));
      } else {
        this.view = new Ext.grid.GridView(Ext.apply({
          forceFit:true
        }, this.viewConfig));
      }
    }

    return this.view;
  }
});

SWorks.FilterField = Ext.extend(Ext.form.TextField, {
  afterRender: function(container) {
    this.el.on('keyup', this.applyGridFilter, this, {buffer: 250});
  },
  applyGridFilter: function(e) {
    var filter = e.getTarget().value;

    if (filter.length===0) {
      this.store.removeFilter(this.regexFilter, this);
    } else {
      var value = filter.replace(/^\s+|\s+$/g, "");
      if (value==="") {
        this.store.removeFilter(regexFilter);
      } else {
        var valueArr = value.split(/\ +/);
        this.filterRegexArray = [];
        //TODO hook into the StatusBar spinner
        for (var i=0; i<valueArr.length; i++) {
          this.filterRegexArray.push(new RegExp(Ext.escapeRe(valueArr[i]), "i"));
        }

        this.store.addFilter(this.regexFilter, this);
      }
    }
  },
  regexFilter: function(r) {
    var reArray = this.filterRegexArray; //threading issues

    if(reArray) {
      // This creates an implicit and between all words in the
      // search that is why we are looking for a false negative
      // instead of a positive match
      for (var i=0; i<reArray.length; i++) {
        var re = reArray[i];
        var decision = false;
        for (var property in r.data) {
          if (re.test(r.data[property]) === true) {
            // If any match, grid record is still a possibility
            decision = true;
          }
         }
         //If none of grid records fields match the current
         //keyword, grid record doesn't match the search
         if (decision === false) {
           return false;
         }
      }
    }
    //All of the keywords matched somthing
    return true;
  }
});
Ext.reg('filter', SWorks.FilterField);

  
/*  createToolbar: function(){
    var tb = [];

    if (this.searchAndRefresh !== false) {
      tb.push(this.createOptionsMenu());
      tb.push('-');
      this.addToolbarSearch(tb);
      if(this.editor) {
        tb.push('-');
      }
    }

    if(this.editor) {
      tb.push({ text: 'Add' });
      tb.push('-');
      tb.push({ text: 'Edit' });
    }

    if(tb.length > 0) { return tb; }
  },
  addToolbarSearch: function(tbArr) {
    tbArr.push(new Ext.Toolbar.TextItem("Quicksearch"));
    tbArr.push(SWorks.createFilterField(this.store));
  },
  createOptionsMenu: function(){
    var viewMenuOptions = [], groupByMenuOptions = [];

    this.buildFilterList(viewMenuOptions);
    if(viewMenuOptions.length > 0) {
      viewMenuOptions.push('-');
    }

    return {
      text: "Options",
      iconCls: 'boptions',
      menu: {
        items: viewMenuOptions.concat([{
          text: 'Refresh',
          handler: this.onClickRefresh,
          scope: this,
          iconCls: 'brefresh'
        }])
      },
      readOnly: true,
      gridOperation: true
    };
  },
  buildFilterList: function(menuArr) {
    if(this.customFilters) {
      var cv = this.customFilters;
      for(var i=0;i<cv.length;i++){
        var v = cv[i];
        var options = {
          checked: (v.isDefault === true),
          text: v.text,
          filterFn: v.filter,
          checkHandler: function(item, checked) {
            if (checked) {
              this.store.addFilter(item.filterFn);
            } else {
              this.store.removeFilter(item.filterFn);
            }
          },
          scope: this
        };
        if(v.isDefault === true) {
          this.store.addFilter(v.filter);
        }
        menuArr.push(options);
      }
    }
  } */
