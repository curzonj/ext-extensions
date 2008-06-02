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

        context.asyncTests--;
        SWorks.Testing.finished(context);
      } catch(err) {
        SWorks.Testing.printError(err);
      }
    };

  },
  finished: function(context) {
    if(context.asyncTests === 0) {
      console.log(context.test.name + ' finished');
      if (typeof SWorks.Testing.barrierFn == 'function') {
        SWorks.Testing.barrierFn(context);
      }
    } else {
      console.log(context.test.name + ' waiting on ' + context.asyncTests +' tests.');
    }
  },
  testWithData: function(fn, scope) {
    var context = this;

    context.asyncTests++;
    return function(store, records, options) {
      try {
        if (records.length < 1) {
          throw "No records found for testing";
        }

        if (context.allRecords === true) {
          for(var i=0;i<records.length;i++) {
            fn.apply(scope, records[i]);
          }
        } else {
          fn.call(scope, records[0]);
        }

        context.asyncTests--;
        SWorks.Testing.finished(context);
      } catch(err) {
        SWorks.Testing.printError(err);
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
      asyncTest: this.asyncTest.createDelegate(context),
      testWithData: this.testWithData.createDelegate(context)
    });

    return context;
  },
  runall: function() {
    try {
      var list = [];
      for (var tname in this.tests) {
        if (typeof this.tests[tname] == 'object') {
          list.push(tname);
        }
      }

      this.barrierFn = function() {
        var test = list.pop();
        if (typeof test == 'string') {
          console.log('running ' + test);
          this.run(test);
        }
      }.createDelegate(this);
      this.barrierFn();
    } catch(err) {
      this.printError(err);
    }
  },
  run: function(name) {
    try {
      var test = this.tests[name];
      if(typeof test != 'object') {
        console.log('No such test: '+name);
        return;
      }
      var context = this.createContext(test);

      setTimeout(function() {
        try {
          test.fn.call(context);
          SWorks.Testing.finished(context);
        } catch(err) {
          SWorks.Testing.printError(err);
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
