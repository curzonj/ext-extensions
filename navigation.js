/*globals SWorks, Ext, URLs */

// TODO Reorganize this file with application.js
SWorks.NavigationTree = Ext.extend(SWorks.DynamicTree, {
  url: URLs.navigation,

  initComponent: function() {
    SWorks.NavigationTree.superclass.initComponent.call(this);

    SWorks.CurrentUser.on('loggedIn', this.load, this);
    SWorks.CurrentUser.on('loggedOut', this.load, this);
  }
});

// This is a helper for registering listeners to load content from the
// navigation menu. 
//   key: The menu item's key and the id of your component. You can customize the
//     menu item's key in app/views/application/_nav.rhtml. By default it is the
//     text, lowercased, with spaces replaced by dashes.
//   fn: A function that will return a panel to be used
SWorks.Menu = {
  panels: {},
  panelFn: {}
};
SWorks.Menu.registerClass = function (key, Klass){ 
  console.assert(typeof Klass.prototype.doLayout == 'function', Klass);

  SWorks.Menu.panelFn[key] = function() {
    return new Klass();
  };

  Ext.ComponentMgr.onAvailable(SWorks.Menu.config.navigation_id, function(tree){
    tree.on('load', function() {
      var node = tree.getNodeById(key);
      if (node) {
        node.on('click', function(){
          SWorks.Menu.loadPanel(key);
        });
      }
    });
  });
};
SWorks.Menu.register = function (key, fn, scope){ 
  SWorks.Menu.panelFn[key] = fn;
  Ext.ComponentMgr.onAvailable(SWorks.Menu.config.navigation_id, function(tree){
    tree.on('load', function() {
      var node = tree.getNodeById(key);
      if (node) {
        node.on('click', function(){
          SWorks.Menu.loadPanel(key);
        });
      }
    });
  });
};
SWorks.Menu.loadPanel = function(key) {
  var t = SWorks.Menu.target, l = SWorks.Menu.layout;
  if (!t || !l) {
    t = SWorks.Menu.target = Ext.getCmp(SWorks.Menu.config.tab_panel_id);
    l = SWorks.Menu.layout = t.getLayout();
  }
  var panel = key.doLayout ? key : SWorks.Menu.panels[key];
  var previous = l.activeItem;

  if(!panel || panel != previous) {
    // Give the mask cpu time to render
    t.el.maskLoading();
    setTimeout(function() {
      if (!panel) {
        // TODO help enforce testability by only accepting classes to instanciate
        // and not some blackbox method
        // SWorks.Menu.panels[key] = panel = new SWorks.Menu.panelFn[key]();
        
        SWorks.Menu.panels[key] = panel = SWorks.Menu.panelFn[key].call(window);
      }

      t.add(panel);
      l.setActiveItem(panel);

      //non-standard, but helpful
      if(previous) {
        previous.fireEvent('deactivate');
      }

      t.el.unmask();

      // non-standard, but helpful, after the mask because
      // it causes visual artifacts, this gives widgets the chance
      // to fix them
      panel.fireEvent('activate'); 
    }, 1);
  }
};

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
