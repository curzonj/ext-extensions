/*globals Ext */

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

