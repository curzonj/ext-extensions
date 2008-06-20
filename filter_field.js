/*globals Ext, SWorks */

Ext.namespace('SWorks');

SWorks.FilterField = Ext.extend(Ext.form.TextField, {
  searchDelay: 250,

  afterRender: function(container) {
    // The toolbar builder assigns our store

    this.el.on('keyup', this.applyGridFilter, this, {buffer: this.searchDelay});
  },
  applyGridFilter: function(e) {
    var filter = e.getTarget().value;

    if (filter.length===0) {
      this.store.removeFilter(this.regexFilter, this);
    } else {
      var value = filter.replace(/^\s+|\s+$/g, "");
      if (value==="") {
        this.store.removeFilter(this.regexFilter, this);
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

SWorks.FerretFilterField = Ext.extend(Ext.form.TextField, {
  afterRender: function(container) {
    SWorks.FerretFilterField.superclass.afterRender.call(this, container);

    this.on('specialkey', this.testForEnterKey, this);
  },
  testForEnterKey: function(item, e) {
    if (e.getKey() == Ext.EventObject.ENTER) {
      this.applyGridFilter();
    }
  },
  applyGridFilter: function() {
    var str = this.getValue().trim();

    if (str === '') {
      this.store.removeFilter('search');
    } else {
      this.store.addFilter('search', '+('+str+')');
    }
    this.store.load();
  }
});
Ext.reg('ferretfilter', SWorks.FerretFilterField);
