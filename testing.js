/*globals Ext, SWorks, runtest */

Ext.namespace('SWorks');

Ext.onReady(function() {
  console.log('application ready');
});

SWorks.Testing = {
  tests: {},

  register: function(name, test, obj) {
    if (typeof test == 'object') {
      obj = test;
      test = obj.main;
    }

    this.tests[name] = {
      name: name,
      fn: test,
      obj: obj
    };
  },

  asyncTest: function(fn, scope) {
    var context = this;

    context.asyncTests++;
    return function() {
      try {
        fn.apply(scope, arguments);
      } catch(err) {
        SWorks.Testing.printError(err);
      }
      context.asyncTests--;
      if(context.asyncTests === 0) {
        console.log('All async tests passed');
      } else {
        console.log(context.asyncTests +' async tests still waiting/running');
      }
    };

  },
  createContext: function(test) {
    var Base = function() {};
    Base.prototype = window;

    var context = new Base();
    Ext.apply(context, test.obj || {});
    Ext.apply(context, {
      test: test,
      asyncTests: 0,
      asyncTest: this.asyncTest.createDelegate(context)
    });

    return context;
  },
  runall: function() {
    try {
      for (var tname in this.tests) {
        this.run(tname);
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
        try {
          test.fn.call(context);
        } catch(err) {
          SWorks.Testing.printError(err);
        }

        if (context.asyncTests === 0) {
          console.log(name + ' test complete');
        } else {
          console.log(name + ' test function returned, waiting on '+context.asyncTests+' async tests to finish');
        }
      }, 1);

      return context;
    } catch(err) {
      this.printError(err);
    }
  },
  printError: function(err) {
    if(typeof err.stack != 'undefined') {
      if (err.fileName.indexOf('jsmock') != -1) {
        console.error(err.fileName + ' @ ' + err.lineNumber+':  ', err);
        console.error(err.stack);
      } else {
        throw err;
      }
    } else {
      console.error(err);
    }
  }
};

Ext.apply(SWorks.Testing, {
  registerTest: SWorks.Testing.register,
  registerTestSuite: SWorks.Testing.register
});

// firebug doesn't like things without scopes
runtest = SWorks.Testing.run.createDelegate(SWorks.Testing);
