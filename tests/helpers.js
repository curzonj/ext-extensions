function replaceAjaxRequest() {
  Ext.Ajax.request = Ext.emptyFn;
  // TODO Find a way to return an empty dataset
  // when the stores try to load
}

Ext.override(Ext.util.Observable, {
  expectsEvent: function(name, mc) {
    mc = mc || window;

    var mock = {};
    var methodName = 'receiveEvent_'+name;
    mock[methodName] = function() {};

    mock = mc.createMock(mock);
    this.on(name, mock[methodName], mock);

    return {
      withArgs: function() {
        mock.expects();
        return mock[methodName].apply(mock, arguments);
      }
    };
  }
});

Function.prototype.dummyObj = function dummyObj(over) {
  return this.prototype.dummyObj();
}

Object.prototype.dummyObj = function dummyObj(over) {
  over = over || {};
  var obj = null;
  if (this instanceof Ext.util.Observable) {
    obj = new Ext.util.Observable();
    obj.events = {};
  } else {
    obj = new Object();
  }

  for (var m in this) {
    if (typeof this[m] == 'function' &&
        typeof obj[m] == 'undefined') {
      obj[m] = Ext.emptyFn;
    }
  }

  Ext.apply(obj, over);
  return obj;
}

Object.prototype.expectsCall = function expectsCall(name, mc) {
  var mockControl = mc || new MockControl();
  var obj = this;
  mockControl.addInjectedExpectation(obj, name);

  var mock = {};
  mock[name] = function() {};
  mock = mockControl.createMock(mock);
 
  var oldMethod = obj[name];
  obj[name] = function() {
    return mock[name].apply(mock, arguments);
  };

  mockControl.andStubOriginal = function() {
    if (this.__lastMock == mock &&
        this.__lastCallName == name) {
      return this.andStub(function() {
        return oldMethod.apply(obj, arguments);
      });
    } else {
      throw "Called andStubOriginal too late, another method has already been mocked";
    }
  };

  return {
    withArgs: function() {
      mock.expects();
      return mock[name].apply(mock, arguments);
    }
  };
}

Ext.apply(MockControl.prototype, {
  originalMockControlVerify: MockControl.prototype.verify,
  verify: function() {
    this.originalMockControlVerify();
    if (this.__injectedExpectations) {
      for (var i=0;i<this.__injectedExpectations.length;i++) {
        var inject = this.__injectedExpectations[i];
        inject.obj[inject.name] = inject.original;
      }
    }
  },

  originalMockControlAndStub: MockControl.prototype.andStub,
  andStub: function() {
    this.originalMockControlAndStub.apply(this, arguments);
    return this;
  },

  originalMockControlAndReturn: MockControl.prototype.andReturn,
  andReturn: function() {
    this.originalMockControlAndReturn.apply(this, arguments);
    return this;
  },

  addInjectedExpectation: function(obj, name) {
    this.__injectedExpectations = this.__injectedExpectations || [];
    this.__injectedExpectations.push({
      obj: obj,
      name: name,
      original: obj[name]
    });
  },

  verifyIn: function(ms, name) {
    var mc = this;
    setTimeout(function() {
      mc.verify();
      if(typeof name == 'string') {
        console.log('mockControl for ' + name + ' verified');
      }
    }, ms*1000);
  }
});
