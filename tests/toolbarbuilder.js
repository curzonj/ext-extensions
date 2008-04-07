
function testSetHandlersAndPermissions() {
  /* Should:
   *   find the handler on the controller
   *   use the controller scope for it's own handlers
   */   

  var detectedGridStore = {
    // For testing the custom filters (TODO)
    addFilter: function() {},
    removeFilter: function() {}
  };
  var mockController = {
    component: {
      store: detectedGridStore
    },
    onClickEditBtn: 'should check property type',
    onClickHideBtn: function() {}, 
    onClickTestBtn: function() {}
  };

  var existingScope = 'existing scope';
  var existingStore = 'already have one';
  var options, add, edit, search1, search2, hide, deleteBtn, test;
  var tbConfig = [
    options = { text: 'Options'}, '-',
    'Preset search',
    search1 = { xtype: 'filter', store: existingStore }, '-',
    'Quicksearch',
    search2 = { xtype: 'filter' }, '-',
    add = { text: 'Add', scope: existingScope },
    edit = { text: 'Edit' },
    hide = { text: 'Hide' },
    deleteBtn = { text: 'Delete' },
    test = { text: 'Test' }
  ];

  var tbarMgr = new SWorks.CrudToolbarMgr(tbConfig, mockController);
  var newTbar = tbarMgr.getToolbar();
  assertNotUndefined(newTbar);

  
  assert('options menu', options.menu instanceof Array);
  for(var i=0;i<options.menu.length;i++){
    var mitem = options.menu[i];
    if(mitem.text == "Refresh") {
      assert('refresh handler', mitem.handler === tbarMgr.onClickRefresh);
      assert('refresh scope', mitem.scope === tbarMgr);
    }
  }
  assert('options gridop', options.gridOperation === true);
  assert('options ro', options.readOnly === true);

  assert('existing store replaced', search1.store === existingStore);
  assert('store not detected', search2.store === detectedGridStore);

  assert('add gridop', add.gridOperation === true);
  assert('add ro', add.readOnly === false);
  assert('add handler', add.handler === tbarMgr.onClickAddBtn);
  assert('add scope', add.scope === existingScope);

  assert('edit gridop', edit.gridOperation === false);
  assert('edit ro', edit.readOnly === true);
  // If the handler property isn't a function, tbMgr won't touch it
  assert('edit handler', typeof edit.handler === 'undefined');
  assert('edit scope', typeof edit.scope === 'undefined');

  assert('hide gridop', typeof hide.gridOperation === 'undefined');
  assert('hide ro', typeof hide.readOnly === 'undefined');
  assert('hide handler', hide.handler === mockController.onClickHideBtn);
  assert('hide scope', hide.scope === mockController);

  assert('deleteBtn', deleteBtn.handler === tbarMgr.onClickDeleteBtn);
  assert('deleteBtn', deleteBtn.scope === mockController);

  assert('outside handler', test.handler === mockController.onClickTestBtn);
  assert('outside scope', test.scope === mockController);
}

function testOnClickEditBtn() {
  inform('running onClickEditBtn');

  var record = {};

  var mockControl = new MockControl();
  var appController = mockControl.createMock(SWorks.GridController);
  appController.expects().getCurrentRecord().andReturn(record);
  appController.expects(record).loadRecord();

  var tbarMgr = new SWorks.CrudToolbarMgr([{ text: 'Edit' }], appController);
  var newTbar = tbarMgr.getToolbar();
  var btn = newTbar.buttons[0];

  btn.handler.call(btn.scope);

  mockControl.verify();
}

