function replaceAjaxRequest() {
  Ext.Ajax.request = Ext.emptyFn;
  // TODO Find a way to return an empty dataset
  // when the stores try to load
}

function assertEventRelay(orig, relay, event, list) {
  eventCount = 0;
  relay.on(event, function() {
      eventCount++;
  });

  var args = [ event ].concat(list||[]);
  orig.fireEvent.apply(orig, args);

  assert('fire '+event, eventCount == 1);
}

function mockStore() {
  var mockStore = createMock(new SWorks.CrudStore({}));
  mockStore.filters = [];

  var fn = function() {
    var found = false;
    for(var i=0; i<mockStore.filters.length;i++) {
      var f = mockStore.filters[i];
      if(f[0] == arguments[0] &&
         f[1] == arguments[1]) {
  
        found = true;
      }
    }
    if(!found) {
      mockStore.filters.push(Array.prototype.slice(arguments, 0));
    }
  };

  mockStore.expectsFilter = function() {
    this.expects().addFilter(TypeOf.isA(Function)).andStub(fn);

    return this;
  }

  return mockStore;
}

