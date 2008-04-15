Ext.namespace('SWorks');

SWorks.registeredTests = SWorks.registeredTests || {};

JSMock.extend(window);

SWorks.Testing = {
    t: SWorks.registeredTests,
    timout: 120000,

    reg: function(name, fn, files) {
      if(typeof this.t[name] != 'undefined') {
        console.log('Reloading test: '+name);
      }
      SWorks.registeredTests[name] = {
        name: name,
        fn: fn,
        files: files
      };
    },
    run: function(name) {
      var set = this.t[name];
      var barrier = 0;
      var fn = function() {
        barrier = barrier - 1;
        if (barrier === 0) {
          SWorks.Testing.executeTest(name);
        }
      }

      if (set.files instanceof Array) {
        barrier = set.files.length;
        for(var i=0;i<set.files.length;i++) {
          SWorks.Testing.reload(set.files[i], fn);
        }
      }
    },
    testComplete: function(name, mc) {
      if (typeof mc != 'undefined') {
        try {
          window.verifyMocks();
          console.log(name + ' was successful');
        } catch(err) {
          this.printError(err);
        }
      }
    },
    executeTest: function(name) {
      try {
        window.resetMocks();

        var result = this.t[name].fn.call(window);

        if (result == 'async') {
          console.log(name + ' is asynchronous');
        } else {
          window.verifyMocks();
          console.log(name + ' was successful');
        }
      } catch(err) {
        this.printError(err);
      }
    },
    printError: function(err) {
      if(typeof err.stack != 'undefined') {
        console.error(err.fileName + ' @ ' + err.lineNumber+':  ', err);
        console.error(err.stack);
      } else {
        console.error(err);
      }
    },
    reload: function (file, cb) {
      Ext.Ajax.request({
        url:   '/javascripts/'+file+'.js',
        callback: function(o, s, r) {
          if(s) {
            eval(r.responseText);
            if (typeof cb == 'function') {
              cb.call(window);
            }
          }
        }
      });
    }
}

// firebug doesn't like things without scopes
runtest = SWorks.Testing.run.createDelegate(SWorks.Testing);
reloadjs = SWorks.Testing.reload.createDelegate(SWorks.Testing);
