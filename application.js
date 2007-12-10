/* Main Script
 * App sets up the main layout. Your component definitions should use
 * App.registerMenuItem() immediately after their defintion
 * in order to link into the application.
 *
 * Remember to use Ext.getCmp() for reference other components. See the project
 * news for questions.
 *
 * The App should be the only place that we load urls from the rails routes.
 * Any code that needs those urls should pull them from here. 
 */

Ext.onReady(function(){
  Ext.QuickTips.init();
  // initialize state manager, we will use cookies
  // TODO disabled for UI development
  //Ext.state.Manager.setProvider(new Ext.state.CookieProvider());

  // The main application layout
  new Ext.Viewport({
    layout:'border',
    items: [
      {
        region: 'north',
        contentEl: 'header',
        height: 50,
        split:false,
        titlebar: false
      },{
        region: 'west',
        title: 'Menu',
        layout: 'fit',
        split:true,
        width: 175,
        minSize: 175,
        maxSize: 400,
        titlebar: true,
        collapsible: true,
        cmargins: '2',
        animate: false,
        items: new NavigationTree({
          id:'navigation-menu',
          initialData: navigationData
        })
      },{
        region: 'south',
        el: 'status',
        height: 22,
        titlebar: false,
        collapsible: false,
        animate: false
      },
      {
        region: 'center',
        layout: 'card',
        id: 'center',
        titlebar: true,
        autoScroll:false,
        preservePanels: true
      }
    ]
  });

  var account_menu = new AccountMenu({
    renderTo:'header',
    contentEl:'account-menu'
  });
  if (!CurrentUser.isLoggedIn()) {
    account_menu.loginWindow.show();
  }
});

// This is a helper for registering listeners to load content from the
// navigation menu. 
//   key: The menu item's key and the id of your component. You can customize the
//     menu item's key in app/views/application/_nav.rhtml. By default it is the
//     text, lowercased, with spaces replaced by dashes.
//   fn: A function that will return a panel to be used
Ext.namespace("Menu");
Menu.panels = {};
Menu.register = function (key, fn, scope){ 
  Ext.ComponentMgr.onAvailable('navigation-menu', function(tree){
    tree.on('load', function() {
      var node = tree.getNodeById(key);
      if (node)
        node.on('click', function(){
          //TODO start spinning a wheel in the status bar and then
          //if they have a ds, then turn it off on('load', otherwise
          //turn it off when we are done here
          var panel = Menu.panels[key];
          if (!panel) {
            Menu.panels[key] = panel = fn.call();
          }

          Menu.loadPanel(panel);
        });
    });
  });
};
Menu.loadPanel = function(panel) {

  var t = Menu.target, l = Menu.layout;
  if (!t || !l) {
    t = Menu.target = Ext.getCmp('center');
    l = Menu.layout = t.getLayout();
  }

  //non-standard, but helpful
  var previous = l.activeItem;
  panel.fireEvent('activate'); 

  t.add(panel);
  l.setActiveItem(panel);

  //non-standard, but helpful
  if(previous)
    previous.fireEvent('deactivate');

};
Ext.onReady(function() {
  CurrentUser.on('loggedOut', function() {
    Menu.loadPanel(new Ext.Panel());
  });
});
