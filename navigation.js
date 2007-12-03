// TODO Reorganize this file with application.js
var NavigationTree = Ext.extend(DynamicTree, {
  url: URLs['navigation'],

  initComponent: function() {
    NavigationTree.superclass.initComponent.call(this);

    CurrentUser.on('loggedIn', this.load, this);
    CurrentUser.on('loggedOut', this.load, this);
  }
});

/*
var StatusBar = function() {

  var version;
  var status_panel = null;

  //Hook ourselves up as soon as we seen the status panel

  return {
    init: function() {
      if (this.status_panel == null ) { 
        this.status_panel = Ext.ComponentMgr.get('main-layout').getRegion('south').panels.get('status');    
        this.status_panel.setContent(""); // clean the p/br/br  added by EXT on empty panels.
        this.version = 0;
        
      }  
    },
    flashStatus: function(message) { // TODO: when will flashStatus be used?
        //status_panel.setContent(message);
    },
    showStatusSpinner: function(message) {
        this.version++;
        el = this.status_panel.el.createChild({
          cls: "loading-indicator x-form-field",
          html: message,
          tag: "span",
          id: "spin_"+this.version
        });
        return this.version;
    },
    finishStatusSpinner: function(version) {
      // takes the version # returned from showStatusSpinner
      // so during multiple calls to show, it will stay
      // shown until the last
      if (el = Ext.get('spin_'+version)) {
       // el.slideOut();
        el.remove();    
      }
      
    },
    hideStatusSpinner: function() {
      // hide it regardless of the spinner version
      this.status_panel.setContent(""); //
    }
  };
}();
Ext.onReady(StatusBar.init, StatusBar, true);
*/
