/*globals Ext */

Ext.ux.HistoryMgr = (function() {
  var PrivateClass = function() {
    // Be aware, you may get a change event with the
    // initial location in addition to the initial event
    this.addEvents('change', 'beforetrack', 'track');
  };
  var swallowLocation = null;

  Ext.extend(PrivateClass, Ext.util.Observable, {
    track: function(name, loc) {
      var opts = { name: name, loc: loc };
      if(this.fireEvent('beforetrack', opts)) {
        document.title = opts.name;

        swallowLocation = opts.loc;
        SWFAddress.setValue(opts.loc);

        this.fireEvent('track', name, loc);
      }
    },
    onLocationChange: function(event) {
      var path = event.path.substring(1);
      if(path == swallowLocation) {
        swallowLocation = null;
      } else {
        this.fireEvent('change', path, event);
      }
    }
  });

  return new PrivateClass();
})();

SWFAddress.addEventListener(SWFAddressEvent.CHANGE,
    Ext.ux.HistoryMgr.onLocationChange.createDelegate(Ext.ux.HistoryMgr));
