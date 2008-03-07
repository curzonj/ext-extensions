/*globals Ext, CSRFKiller */

Ext.namespace("SWorks", "Ext.ux", "Ext.ux.data", "Ext.ux.tree", "Ext.ux.grid"); //Used by extensions

Ext.override(Ext.TabPanel, {
  showPanel:function(p) {
    p.render(Ext.getBody());
    p.doLayout();

    this.add(p);
    this.setActiveTab(p);
    p.doLayout();
  }
});

// Required by data mirroring
Ext.override(Ext.util.Observable, {
  resetEvents: function() {
    var e, es = this.events;
    this.events = {};
    for(e in es) {
      this.events.e = true;
    }
  }
});

Ext.override(Ext.form.BasicForm, {
  updateOriginalValues: function(values) {
    var field;
    for(var id in values) {
      if(typeof values[id] != 'function' && (field = this.findField(id))){
        if (field.constructor == Ext.form.DateField) {
          field.originalValue = field.parseDate(values[id]);
        } else {
          field.originalValue = values[id];
        }
      }
    }
  }
});

Ext.onReady(function() {
  if(typeof CSRFKiller != 'undefined' && CSRFKiller.field) {
    Ext.Ajax.on('beforerequest', function(conn, options) {
      if(typeof options.params == 'object') {
        //Make the two possibilities easier
        options.params = Ext.urlEncode(options.params);
      } 

      if(options.params && typeof options.params == "string") {
        options.params = options.params+'&'+CSRFKiller.field+'='+CSRFKiller.token;
      } else if(typeof options.params == 'undefined' && options.form) {
        options.params = CSRFKiller.field+'='+CSRFKiller.token;
      }
    });
  }
});

Ext.override(Ext.form.Field, {
  setFieldLabel: function(text) {
    var ct = this.el.findParent('div.x-form-item', 3, true);
    var label = ct.first('label.x-form-item-label');
    label.update(text);
  }
});

Ext.override(Ext.Element, {
  maskLoading: function(timeout) {
    this.mask('Loading...', 'x-mask-loading');

    if(timeout) {
      var me = this;
      setTimeout(function() {
        me.unmask();
      }, timeout);
    }
  }
});

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

// This allows you to override the parseValue function to allow
// things like '12 ft' -> 144. 'baseChars' would need to be set 
// appropriately too.
Ext.override(Ext.form.NumberField, {
  validateValue : function(value){
    if(!Ext.form.NumberField.superclass.validateValue.call(this, value)){
        return false;
    }
    if(value.length < 1){
      return true;
    }
    var num = this.parseValue(value);
    if(isNaN(num)){
        this.markInvalid(String.format(this.nanText, value));
        return false;
    }
    if(num < this.minValue){
        this.markInvalid(String.format(this.minText, this.minValue));
        return false;
    }
    if(num > this.maxValue){
        this.markInvalid(String.format(this.maxText, this.maxValue));
        return false;
    }
    return true;
  }
});

Ext.form.NumberField.fractionRe = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;
Ext.form.NumberField.conversions = [
  { re:  /^\s*(.+)\s*ft?\s*$/, multi: 12 },
  { re:  /^\s*(.+)\s*hr?\s*$/, multi: 60 }
];
Ext.override(Ext.form.NumberField, {
  baseChars: "0123456789 fthr",
  initEvents : function(){
    Ext.form.NumberField.superclass.initEvents.call(this);
    var allowed = this.baseChars+'';
    if(this.allowDecimals){
        allowed += this.decimalSeparator;
        allowed += '/'; // This is the only line added in this function
    }
    if(this.allowNegative){
        allowed += "-";
    }
    this.stripCharsRe = new RegExp('[^'+allowed+']', 'gi');
    var keyPress = function(e){
        var k = e.getKey();
        if(!Ext.isIE && (e.isSpecialKey() || k == e.BACKSPACE || k == e.DELETE)){
            return;
        }
        var c = e.getCharCode();
        if(allowed.indexOf(String.fromCharCode(c)) === -1){
            e.stopEvent();
        }
    };
    this.el.on("keypress", keyPress, this);
  },
  parseValue: function(value) {
    var con = self.conversions || Ext.form.NumberField.conversions;
    var multi = 1;
    for(var i=0;i<con.length;i++) {
      var set = con[i];
      var match = set.re.exec(value);
      if(match) {
        value = match[1];
        multi = set.multi;
        break;
      }
    }

    var fracMatch = Ext.form.NumberField.fractionRe.exec(value);
    if(fracMatch) {
      if(!isNaN(fracMatch[1]) && !isNaN(fracMatch[2]) &&
         (fracMatch[1] !== 0) && (fracMatch[2] !== 0)) {
        value = fracMatch[1] / fracMatch[2];
      }
    }

    value = parseFloat(String(value).replace(this.decimalSeparator, "."));
    if(isNaN(value)) {
      return '';
    } else {
      return (value * multi);
    }
  }
});

Ext.override(Ext.data.Store, {
  // Their load records function isn't very extensible,
  // so I had to copy it in here
  loadRecords : function(o, options, success){
    if(!o || success === false){
        if(success !== false){
            this.fireEvent("load", this, [], options);
        }
        if(options.callback){
            options.callback.call(options.scope || this, [], options, false);
        }
        return;
    }
    var r = o.records, t = o.totalRecords || r.length;
    if(!options || options.add !== true){
        if(this.pruneModifiedRecords){
            this.modified = [];
        }
        for(var i = 0, len = r.length; i < len; i++){
            r[i].join(this);
        }
        if(this.snapshot){
            this.data = this.snapshot;
            delete this.snapshot;
        }
        this.data.clear();
        this.data.addAll(r);
        this.totalLength = t;

        this.onDataChanged(); //This line added

        this.fireEvent("datachanged", this);
    }else{
        this.totalLength = Math.max(t, this.data.length+r.length);
        this.add(r);
    }

    this.fireEvent("load", this, r, options);
    if(options.callback){
        options.callback.call(options.scope || this, r, options, true);
    }
  },
  onDataChanged: function() {
    this.applySort();
  }
});


Ext.override(Ext.tree.TreeNodeUI, {
  onDblClick : function(e){
    e.preventDefault();
    if(this.disabled){
      return;
    }
    if(this.checkbox){
      this.toggleCheck();
    }
    // Removed expanding the node, put a dblclick
    // listener on if you want it
    this.fireEvent("dblclick", this.node, e);
  }
});

Ext.override(Ext.Window, {
  showMask: function() {
    if(this.modal){
      Ext.getBody().addClass("x-body-masked");
      this.mask.setSize(Ext.lib.Dom.getViewWidth(true), Ext.lib.Dom.getViewHeight(true));
      this.mask.show();
    }
  },
  hideMask: function() {
    if(this.modal){
      this.mask.hide();
      Ext.getBody().removeClass("x-body-masked");
    }
  }
});

Ext.override(Ext.tree.TreePanel, {
  findNode: function(prop, value) {
    return this.findNodeBy(function(node) {
      return (node.attributes[prop] == value);
    });
  },
  findNodeBy: function(fn, scope) {
    for (var id in this.nodeHash) {
      var node = this.nodeHash[id];
  
      // It's up to the user to specify unique
      // constraints
      if(fn.call((scope || this),  node)) {
        return node;
      }
    }
  }
});

Ext.override(Ext.grid.GroupingView, {
    doRender : function(cs, rs, ds, startRow, colCount, stripe){
        if(rs.length < 1){
            return '';
        }
        var groupField = this.getGroupField();
        var colIndex = this.cm.findColumnIndex(groupField);

        this.enableGrouping = !!groupField;

        if(!this.enableGrouping || this.isUpdating){
            return Ext.grid.GroupingView.superclass.doRender.apply(
                    this, arguments);
        }
        var gstyle = 'width:'+this.getTotalWidth()+';';

        var gidPrefix = this.grid.getGridEl().id;
        var cfg = this.cm.config[colIndex];
        var groupRenderer = cfg.groupRenderer || cfg.renderer;
        var cls = this.startCollapsed ? 'x-grid-group-collapsed' : '';
        var prefix = this.showGroupName ?
                     (cfg.groupName || cfg.header)+': ' : '';

        var groups = [], curGroup, i, len, gid;
        for(i = 0, len = rs.length; i < len; i++){
            var rowIndex = startRow + i;
            var r = rs[i],
                gvalue = r.data[groupField],
                g = this.getGroup(gvalue, r, groupRenderer, rowIndex, colIndex, ds);
            if(!curGroup || curGroup.group != g){
                // Here is the change
                // set the gid to be the value so the renderer can change the text and 
                // preserve the toggle state of the group
                gid = gidPrefix + '-gp-' + groupField + '-' + gvalue;
                // If the user opened it, leave it open, otherwise do the default
                var gcls = this.state[gid] === true ? '' : cls;
                // End of change
                curGroup = {
                    group: g,
                    gvalue: gvalue,
                    text: prefix + g,
                    groupId: gid,
                    startRow: rowIndex,
                    rs: [r],
                    cls: gcls,
                    style: gstyle
                };
                groups.push(curGroup);
            }else{
                curGroup.rs.push(r);
            }
            r._groupId = gid;
        }

        var buf = [];
        for(i = 0, len = groups.length; i < len; i++){
            var g = groups[i];
            this.doGroupStart(buf, g, cs, ds, colCount);
            buf[buf.length] = Ext.grid.GroupingView.superclass.doRender.call(
                    this, cs, g.rs, ds, g.startRow, colCount, stripe);

            this.doGroupEnd(buf, g, cs, ds, colCount);
        }
        return buf.join('');
    }
});
