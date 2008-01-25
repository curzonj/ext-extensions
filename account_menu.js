/*globals SWorks, Ext, URLs, permissionsData */

SWorks.CurrentUser = function() {
  this.url = URLs.current_permissions;
  this.permissions = {};
  this.loggedIn = false;

  this.addEvents({
    'loggedIn': true,
    'loggedOut': true,
    'permissionsChanged': true
  });
  this.on('loggedIn', this.load, this);
  this.on('loggedOut', function() { this.setPermissions(null); }, this);
}
Ext.extend(SWorks.CurrentUser, Ext.util.Observable, {
  isLoggedIn: function() {
    return this.loggedIn;
  },
  username: function() {
    return this.permissions.username;  
  },
  setPermissions: function(newdata) {
    if(newdata) {
      this.loggedIn = true;
    } else {
      this.loggedIn = false;
      newdata = {};
    }
    this.permissions = newdata;
    this.fireEvent('permissionsChanged', this.permissions);
  },
  load: function() {
    Ext.Ajax.request({
      url: this.url,
      success: function(response) {
        try {
          var result = Ext.decode(response.responseText);
          this.setPermissions(result);
        } catch(err) {}
      },
      scope: this
    });
  },
  has: function(perm) {
    return (this.permissions[perm] === true);
  },
  // The reason there is no straight permissions check is because
  // they can change with time and you have to be ready for that.
  onPermission: function(perm, callback, scope) {
    var permCheck = function(p) {
      if (p[perm]) {
        callback.call(scope, perm, true);
      } else {
        callback.call(scope, perm, false);
      }
    }
    this.on('permissionsChanged', permCheck);
    permCheck(this.permissions);
  }
});
SWorks.CurrentUser = new SWorks.CurrentUser();
SWorks.CurrentUser.setPermissions(permissionsData);

SWorks.AccountMenu = Ext.extend(Ext.Panel, {
  loginUrl: URLs.session,
  menuUrl: URLs.account_menu,

  initComponent: function() {
    SWorks.AccountMenu.superclass.initComponent.call(this);
    //This doesn't render yet, so it should be pretty quick
    this.loginWindow = this.createLoginWindow();
  },
  afterRender : function(ct, position){
    SWorks.AccountMenu.superclass.afterRender.call(this, ct, position);

    //Set the panel to reload its content on login or logout
    var mgr = this.getUpdater();
    mgr.setDefaultUrl(this.menuUrl);
    SWorks.CurrentUser.on('loggedIn', mgr.refresh, mgr);
    SWorks.CurrentUser.on('loggedOut', mgr.refresh, mgr);

    // Rewire the content when it gets updated
    mgr.on('update', this.hookContent, this);

    // Manually wire the content the first time
    this.hookContent();
  },
  hookContent: function(){
    // Wire the login link
    var signinLink = Ext.get('signin-link');
    if(signinLink) {
      signinLink.on('click', function(e,t){
        this.loginWindow.show(t.dom);
      }, this);
    }

    // A panel should listen for the update on our updater and wire to the
    // account-status element if it is there.

    // Wire the logout link
    var logoutLink = Ext.get('logout-link');
    if(logoutLink) {
      logoutLink.on('click', function(){
          if(!this.loginWindow.rendered) {
            this.loginWindow.render(Ext.getBody());
          }
          this.loginWindow.showMask();
          Ext.Ajax.request({
            url: URLs.logout,
            success: function(){
              SWorks.CurrentUser.fireEvent('loggedOut');
              this.loginWindow.show();
            },
            failure: function(){
              Ext.MessageBox.alert("Logout failed","There was an error when logging out. Please try again.");
              this.loginWindow.hideMask();
            },
            scope: this
          });
      }, this);
    }
  },
  createLoginWindow: function() {
    var form = null, url = this.loginUrl;
    var panel;
    var win = new Ext.Window({
      layout: 'fit',
      width: 270,
      height: 150,
      modal: true,
      closable: false,
      resizable: false,
      draggable: true,
      collapsible: false,
      title: 'Sign in',
      autoCreate: true,

      items: panel = new Ext.form.FormPanel({
        labelAlign: 'right',
        labelWidth: 68,
        buttonAlign: 'right',
        bodyStyle: 'padding:5px',
        items: [
          new Ext.form.TextField({
            id: 'login-user-name-field',
            fieldLabel: 'Username',
            name: 'login',
            allowBlank: false,
            width: 140
          }),
          new Ext.form.TextField({
            id: 'password-field',
            fieldLabel: 'Password',
            name: 'password',
            inputType: 'password',
            allowBlank: false,
            width: 140
          })
        ],
        login: function() {
          if(win.submitLock) {
            return;
          }
          win.submitLock = true;
          win.keyMap.disable();

          panel.form.submit({
            url: url,
            waitMsg: 'Please wait...',
            success: function(form, action) {
              win.submitLock = false;
              win.hide();
              SWorks.CurrentUser.fireEvent("loggedIn");
            },
            failure: function() {
              Ext.MessageBox.alert('Login failed', "The username or password is not correct. Please try again.");
              // TODO the field focus isn't working
              win.submitLock = false;
              win.keyMap.enable();
              panel.form.reset();
              panel.form.items.item(0).focus();
            }
          });
        }
      }),
      buttons: [{
        id: 'signin-submit-btn',
        text: "Sign in",
        handler: function() {
          panel.login();
        }
      }/*, {
        text: "Cancel",
        handler: function() {
          win.hide();
        }
      }*/],
      keys: [
        { key: 27, fn: function() { win.hide(); }},
        { key: Ext.EventObject.ENTER, fn: function() { panel.login(); }}
      ]
    });
    // TODO all dialog focus attempts in the whole app are broken
    win.on('show', function() {
      panel.form.items.item(0).on('blur', function(field){
        var test = 0;
      });
      panel.form.reset();
      panel.form.items.item(0).focus();
      var test = 0;
    });

    return win;
  }
})

