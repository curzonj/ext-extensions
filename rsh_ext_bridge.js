/*globals Ext, dhtmlHistory */

Ext.namespace('Ext.ux');

Ext.ux.HistoryMgr = (function() {
  var PrivateClass = function() {
    // Be aware, you may get a change event with the
    // initial location in addition to the initial event
    this.addEvents('initial', 'change');
  };
  var firstLocation;
  Ext.extend(PrivateClass, Ext.util.Observable, {
    track: function(name, loc, data) {
      document.title = name;
      if (typeof loc != 'string') {
        data = loc;
        loc = name;
      }
      dhtmlHistory.add(loc, data);
    },
    currentLocation: function() {
      return dhtmlHistory.getCurrentLocation();
    },
    setInitialLocation: function(loc) {
      firstLocation = loc;
      this.fireEvent('initial', loc);
    },
    getInitialLocation: function() {
      return firstLocation;
    }
  });

  return new PrivateClass();
})();

dhtmlHistory.create({
  toJSON: function(o) {
    return Ext.util.JSON.encode(o);
  },
  fromJSON: function(s) {
    return Ext.util.JSON.decode(s);
  }
});

dhtmlHistory.ExtBridge = function() {
  if (typeof dhtmlHistory.ExtBridge.previousOnLoad == 'function') {
    dhtmlHistory.ExtBridge.previousOnLoad.call(window);
  }

  dhtmlHistory.initialize();
  dhtmlHistory.addListener(function(newLocation, historyData) {
    Ext.ux.HistoryMgr.fireEvent('change', newLocation, historyData);
  });

  var initialLocation = dhtmlHistory.getCurrentLocation();
  Ext.ux.HistoryMgr.setInitialLocation(initialLocation);
};

dhtmlHistory.ExtBridge.previousOnLoad = window.onload;
window.onload = dhtmlHistory.ExtBridge;


