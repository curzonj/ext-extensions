/*globals Ext, CSRFKiller, SWorks, console */
/*jslint glovar: true, undef: true, browser: true */

Ext.reg('propertygrid', Ext.grid.PropertyGrid);

Ext.override(Ext.Panel, {
  showPanel:function(panel) {
    var previous = this.getLayout().activeItem;

    this.add(panel);
    this.getLayout().setActiveItem(panel);
    this.doLayout();

    //non-standard, but helpful
    if(previous) {
      previous.fireEvent('deactivate');
    }

    // non-standard, but helpful, after the mask because
    // it causes visual artifacts, this gives widgets the chance
    // to fix them
    panel.fireEvent('activate'); 
  }
});

Ext.override(Ext.TabPanel, {
  showPanel:function(p) {
    p.render(Ext.getBody());
    p.doLayout();

    this.add(p);
    this.setActiveTab(p);
    p.doLayout();
  }
});

Object.prototype.deferFn = function deferFn(method, millis, args, appendargs) {
  this[method].defer(millis, this, args, appendargs);
};

// Required by data mirroring
Ext.override(Ext.util.Observable, {
  resetEvents: function() {
    var e, es = this.events;
    this.events = {};
    for(e in es) {
      if (typeof es[e] != 'function') {
        this.events[e] = true;
      }
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
          field.originalValue = field.parseDate(values[id]) || '';
        } else {
          field.originalValue = values[id];
        }
      }
    }
  },
  extractUnreportedErrors: function(errors){
    var messages = []

    if(Ext.isArray(errors)){
      for(var i = 0, len = errors.length; i < len; i++){
        var fieldError = errors[i];
        var f = this.findField(fieldError.id);
        if(!f){
          messages.push(fieldError.msg);
        }
      }
    }else{
      for(var id in errors){
        var field = null;
        if(typeof errors[id] != 'function') {
          field = this.findField(id);

          if (!field || field.constructor == Ext.form.Hidden) {
            messages.push(errors[id]);
          }
        }
      }
    }

    return messages;
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
      if (typeof this.nodeHash[id] != 'function') {
        var node = this.nodeHash[id];
    
        // It's up to the user to specify unique
        // constraints
        if(typeof node == 'object' && fn.call((scope || this),  node)) {
          return node;
        }
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

Ext.util.Format.dateRenderer = function(format){
  return function(v){
    try {
      return Ext.util.Format.date(v, format);
    } catch(e) {
      return "Invalid";
    }
  };
};

Ext.override(Ext.data.Connection, {
  handleFailure : function(response, e){
    this.transId = false;
    var options = response.argument.options;
    response.argument = options ? options.argument : null;
    // This allows the exception handler to implement recovery mechanisms
    if(this.fireEvent("requestexception", this, response, options, e)) {
      Ext.callback(options.failure, options.scope, [response, options]);
      Ext.callback(options.callback, options.scope, [options, false, response]);
    }
  }
});

Ext.lib.Ajax.serializeForm = function(form) {
    if(typeof form == 'string') {
        form = (document.getElementById(form) || document.forms[form]);
    }

    var el, name, val, disabled, data = '', hasSubmit = false;
    for (var i = 0; i < form.elements.length; i++) {
        el = form.elements[i];
        disabled = form.elements[i].disabled;
        name = form.elements[i].name;
        val = form.elements[i].value;

        if (!disabled && name){
            switch (el.type)
                    {
                case 'select-one':
                case 'select-multiple':
                    for (var j = 0; j < el.options.length; j++) {
                        if (el.options[j].selected) {
                            if (Ext.isIE) {
                                data += encodeURIComponent(name) + '=' + encodeURIComponent(el.options[j].attributes.value.specified ? el.options[j].value : el.options[j].text) + '&';
                            }
                            else {
                                data += encodeURIComponent(name) + '=' + encodeURIComponent(el.options[j].hasAttribute('value') ? el.options[j].value : el.options[j].text) + '&';
                            }
                        }
                    }
                    break;
                case 'radio':
                case 'checkbox':
                    if (el.checked) {
                        data += encodeURIComponent(name) + '=' + encodeURIComponent(true) + '&';
                    } else {
                        data += encodeURIComponent(name) + '=' + encodeURIComponent(false) + '&';
                    }
                    break;
                case 'file':

                case undefined:

                case 'reset':

                case 'button':

                    break;
                case 'submit':
                    if(hasSubmit === false) {
                        data += encodeURIComponent(name) + '=' + encodeURIComponent(val) + '&';
                        hasSubmit = true;
                    }
                    break;
                default:
                    data += encodeURIComponent(name) + '=' + encodeURIComponent(val) + '&';
                    break;
            }
        }
    }
    data = data.substr(0, data.length - 1);
    return data;
};

Ext.override(Ext.data.HttpProxy, {
    load : function(params, reader, callback, scope, arg){
        if(this.fireEvent("beforeload", this, params) !== false){
            var  o = {
                method : arg.method,
                url : arg.url,

                params : params || {},
                request: {
                    callback : callback,
                    scope : scope,
                    arg : arg
                },
                reader: reader,
                callback : this.loadResponse,
                scope: this
            };
            if(this.useAjax){
                Ext.applyIf(o, this.conn);
                if(this.activeRequest){
                    console.warn("Aborting existing proxy request:");
                    console.dir(this.activeRequest);
                    console.trace();

                    Ext.Ajax.abort(this.activeRequest);
                }
                this.activeRequest = Ext.Ajax.request(o);
            }else{
                this.conn.request(o);
            }
        }else{
            callback.call(scope||this, null, arg, false);
        }
    }
});

Ext.override(Array, {
  insertBefore: function(current, newItem) {
    var index = this.indexOf(current);
    return this.insertAt(index, newItem);
  },
  insertAfter: function(current, newItem) {
    var index = this.indexOf(current) ;
    return this.insertAt(index+1, newItem);
  },
  insertAt: function(index, newItem) {
    if (index != -1 && index <= this.length) {
      var front = this.slice(0,index);
      var back = this.slice(index);

      front.push(newItem);
      return front.concat(back);
    }
  }
});
