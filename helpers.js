/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

SWorks.download = function(url) {
  Ext.DomHelper.append(Ext.getBody(), {
    src: url,
    tag: 'iframe',
    id: Ext.id(),
    cls: 'x-hidden'
  });
};

SWorks.getVtypeRegexFn = function(mask) {
  return function(value) {
    return mask.test(value);
  };
};

Ext.form.VTypes.phoneNumberText = "Phone number is invalid";
Ext.form.VTypes.phoneNumberMask = /[1234567890\-\ ]/;
Ext.form.VTypes.phoneNumber = function(value) {
  var ph = value.replace(/\D/g, "");
  if(ph.length < 10) {
    return "Area code is required.";
  } else {
    return true;
  }
};

Ext.form.VTypes.zipCodeText = "Zip code is invalid";
Ext.form.VTypes.zipCodeMask = /[1234567890\-]/;
Ext.form.VTypes.zipCode = SWorks.getVtypeRegexFn(/^\d{5}(?:-\d{4})?$/);

Ext.util.Format.mysqlDateRenderer = function(fmt){  
  var raw = Ext.util.Format.dateRenderer(fmt);

  return function(value) {
    dv = Date.parseDate(value, 'Y-m-d')
    return raw(dv);
  };
};
Ext.util.Format.yesNo = function(value){  
  return value ? "Yes" :  "No";
};
Ext.util.Format.csvArray = function(value){  
  return ((value && value.join) ? value.join(", ") : "");
};
Ext.util.Format.dateMjy = function(value) {
  return Date.parseDate(value, 'Y/m/d H:i:s').format("M j Y");
};
Ext.util.Format.hourlyRate = function(v){
  return Ext.util.Format.usMoney(v) + " / hour";
};
Ext.util.Format.quickTips = function(v,m,r) {
  if (r.data.quicktip) {
    m.attr = 'ext:qtip=\''+Ext.util.Format.htmlEncode(r.data.quicktip).replace("\n",'<br/>')+'\'';
  }
  return Ext.util.Format.htmlEncode(v);
};

SWorks.renderers = {
  joinFields: function(list) {
    list = list.splice(0);
    return function(v, meta, record) {
      var ret = [];
      for(var i=0;i<list.length;i++) {
        var value = record.data[list[i]];
        if(value && value !== '') {
          ret.push(value);
        }
      }
      return ret.join(', ');
    };
  }
};
