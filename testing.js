Ext.namespace('SWorks');

Ext.onReady(function() {
  console.log('application ready');
});

SWorks.Testing = {
  tests: {},

  registerTest: function(name, fn, files) {
    this.tests[name] = {
      name: name,
      fn: fn
    };
  },
  registerTestSuite: function(name, obj) {
    this.tests[name] = {
      name: name,
      fn: obj.main,
      obj: obj
    };
  },
  createContext: function(test) {
    var Base = function() {};
    Base.prototype = window;

    var context = new Base();
    Ext.apply(context, test.obj || {});
    Ext.apply(context, { test: test });

    return context;
  },
  runall: function() {
    try {
      for (var tname in this.tests) {
        run(tname);
      }
    } catch(err) {
      this.printError(err);
    }
  },
  run: function(name) {
    try {
      var test = this.tests[name];
      var context = this.createContext(test);

      setTimeout(function() {
        test.fn.call(context);
      }, 1);

      return context;
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
  }
};

// firebug doesn't like things without scopes
runtest = SWorks.Testing.run.createDelegate(SWorks.Testing);
