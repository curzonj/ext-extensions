/*globals Ext, CSRFKiller, SWorks */

Ext.reg('propertygrid', Ext.grid.PropertyGrid);

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

Ext.override(Ext.util.Event, {
    addListener : function(fn, scope, options){
        scope = scope || this.obj;
        if (typeof fn != 'function') {
          throw ("Undefined function for listener: " + this.name);
        }

        if(!this.isListening(fn, scope)){
            var l = this.createListener(fn, scope, options);
            if(!this.firing){
                this.listeners.push(l);
            }else{                    
                this.listeners = this.listeners.slice(0);
                this.listeners.push(l);
            }
        }
    }
});
Ext.override(Ext.grid.GridView, {
  // There is a listener for this, but no method
  onColumnLock: Ext.emptyFn
});

Ext.override(Ext.form.BasicForm, {
  updateOriginalValues: function(values) {
    var field;
    for(var id in values) {
      if(typeof values[id] != 'function' && (field = this.findField(id))){
        if (field instanceof Ext.form.DateField) {
          field.originalValue = field.parseDate(values[id]);
        } else {
          field.originalValue = values[id];
        }
      }
    }
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
            var g3 = groups[i];
            this.doGroupStart(buf, g3, cs, ds, colCount);
            buf[buf.length] = Ext.grid.GroupingView.superclass.doRender.call(
                    this, cs, g3.rs, ds, g3.startRow, colCount, stripe);

            this.doGroupEnd(buf, g3, cs, ds, colCount);
        }
        return buf.join('');
    }
});
