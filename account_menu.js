/*globals SWorks, Ext */

SWorks.CurrentUser = function() {
  this.permissions = {};
  this.loggedIn = false;

  this.addEvents({
    'loggedIn': true,
    'loggedOut': true,
    'permissionsChanged': true
  });
  this.on('loggedIn', this.load, this);
  this.on('loggedOut', function() { this.setPermissions(null); }, this);
};
Ext.extend(SWorks.CurrentUser, Ext.util.Observable, {
  setUrls: function(hash) {
    this.permissionsUrl = hash.permissions;
    this.logoutUrl = hash.logout;
  },
  isLoggedIn: function() {
    return this.loggedIn;
  },
  logout: function(cb, scope) {
    Ext.Ajax.request({
      url: this.logoutUrl,
      callback: function(options, success, response) {
        if(success) {
          SWorks.CurrentUser.fireEvent('loggedOut');
        } else {
          Ext.MessageBox.alert("Logout failed","There was an error when logging out. Please try again.");
        }
        if(cb) {
          cb.call(scope || this, success, response);
        }
      },
      scope: this
    });
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
      url: this.permissionsUrl,
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
    return (typeof perm == 'undefined' || this.permissions[perm] === true);
  },
  // The reason there is no straight permissions check is because
  // they can change with time and you have to be ready for that.
  onPermission: function(perm, callback, scope) {
    var permCheck = function(p) {
      if (typeof perm == 'undefined' || p[perm]) {
        callback.call(scope, perm, true);
      } else {
        callback.call(scope, perm, false);
      }
    };
    this.on('permissionsChanged', permCheck);
    permCheck(this.permissions);
  }
});
SWorks.CurrentUser = new SWorks.CurrentUser();

SWorks.AccountMenu = Ext.extend(Ext.Panel, {
  initComponent: function() {
    SWorks.AccountMenu.superclass.initComponent.call(this);
    //This doesn't render yet, so it should be pretty quick
    this.loginWindow = this.createLoginWindow();

    if(this.loginRequired) {
      SWorks.CurrentUser.on('loggedOut', function() {
        this.loginWindow.show();
      }, this);
    }
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
          SWorks.CurrentUser.logout(function(success, response) {
            if (!success) {
              this.loginWindow.hideMask();
            }
          }, this);
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
            url: this.loginUrl,
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
      }, {
        text: "Cancel",
        disabled: this.loginRequired,
        handler: function() {
          win.hide();
        }
      }],
      keys: [
        { key: 27, fn: (this.loginRequired ? Ext.emptyFn : function() { win.hide(); }) },
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
    });

    return win;
  }
});

