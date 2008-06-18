
function testSaveFormNotValid() {
  var dm = buildDataModel();
  var form  = mc.createMock(Ext.form.BasicForm);
  form.expects().isValid().andReturn(false);

  dm.saveForm(form, { waitMsg: false });

  mc.verify();

  form.expects().isValid().andReturn(false);
  Ext.MessageBox.expects().alert(TypeOf.isA(String), TypeOf.isA(String));

  dm.saveForm(form, {}); // Without waitMsg:false

  mc.verify();
}

function testSaveFormValid() {
  var options = {};
  var dm = buildDataModel();

  var form  = mc.createMock(Ext.form.BasicForm);
  form.record = { newRecord: false };

  dm.controller = mc.createMock(SWorks.AbstractController);

  form.expects().isValid().andReturn(true);
  form.expects().updateRecord(TypeOf.isA(dm.recordType));
  form.expects().submit(options);

  dm.saveForm(form, options);
  mc.verify();

  // Shouldn't try to save while another save is going
  dm.saveForm(form, options);
  mc.verify();
}

function testSaveFormWithParent() {
  var options = {};
  var dm = buildDataModel();

  var form  = mc.createMock(Ext.form.BasicForm);
  form.record = { newRecord: false };

  dm.controller = mc.createMock(SWorks.AbstractController);
  dm.controller.parentForm = mc.createMock(Ext.form.BasicForm);
  dm.controller.parentForm.record = {
    id: Ext.id(),
    data: { klass: 'bob' },
    getKlass: function() {
      return this.data.klass;
    }
  };

  form.expects().isValid().andReturn(true);
  form.expects().updateRecord(TypeOf.isA(dm.recordType));
  form.expects().submit(options);

  dm.saveForm(form, options);
  mc.verify();

  // Shouldn't try to save while another save is going
  dm.saveForm(form, options);
  mc.verify();
}


function testFormSuccess() {
  // Test with a basic form not inited by a controller
  var dm = buildDataModel();
  var form  = new Ext.form.BasicForm();
  var action = { result: {}, options: { dataSentRecord: new dm.recordType() } };

  // new record
  form.record = new dm.recordType();
  form.record.newRecord = true;
  dm.on('save', function() { assert('newBeforeSave', action.newBeforeSave == true); });
  dm.formSuccess(form, action);
  mc.verify();

  // existing record
  form.record = new dm.recordType();
  dm.formSuccess(form, action);
  mc.verify();
}


function testFetchRecord() {
  var result = null, id = 1, opts = {};
  var data_model = buildDataModel();

  function bridge() {
    Ext.MessageBox.expects().wait(TypeOf.isA(String));
    Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(opts).andStub(
      function() {
        assertEquals('url', String.format(data_model.restUrl, id), opts.url);
        opts.callback.call(opts.scope, result, opts);
      });
    Ext.MessageBox.expects().updateProgress(1);
    Ext.MessageBox.expects().hide();
  }

  // Server sends invalid response
  result = { };
  bridge();
  SWorks.ErrorHandling.expectsCall('serverError', mc).withArgs(result);
  data_model.fetchRecord(id, opts);
  mc.verify();

  // Test the callback
  result = { success: true, objectid: id, data: { id: 'joe schmo', name: 'wohoo' } };
  bridge();
  opts.expectsCall('callback', mc).withArgs(TypeOf.isA(data_model.recordType)).andStub(
      function(record) {
        assertEquals('record id', id, record.id);
        assertEquals('record data', result.data.name, record.data.name);
      });
  data_model.fetchRecord(id, opts);
  mc.verify();
}

function testPostToRecord() {
  var result = null, id = 1, opts = {};
  var data_model = buildDataModel();

  // a new record
  opts = {
    record: new data_model.recordType({name: 'yo, Bobo!'}),
    waitMsg: false
  };
  opts.record.newRecord = true;
  data_model.expectsCall('setUpdateOrCreate', mc).
      withArgs(opts.record, opts).andStubOriginal();
  Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(opts).andStub(
      function() {
        assertEquals('url from create', data_model.createUrl, opts.url);
      });
  data_model.postToRecord(opts);
  mc.verify();

  // an existing record
  opts = {
    record: new data_model.recordType({id: 1, name: 'yo, Bobo!'}, 1),
    waitMsg: false
  };
  data_model.expectsCall('setUpdateOrCreate', mc).
      withArgs(opts.record, opts).andStubOriginal();
  Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(opts).andStub(
      function() {
        assertEquals('url from record',
              String.format(data_model.restUrl, opts.record.id),
              opts.url);
      });
  data_model.postToRecord(opts);
  mc.verify();

  // id in the options
  opts = {
    id: 1,
    waitMsg: 'waitmsg'
  };
  Ext.MessageBox.expects().wait(opts.waitMsg);
  Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(opts).andStub(
      function() {
        assertEquals('url from record',
              String.format(data_model.restUrl, opts.id),
              opts.url);
      });
  data_model.postToRecord(opts);
  mc.verify();

  // id in the arguments
  var staticUrl = 'testUrl';
  opts = {
    url: staticUrl
  };
  Ext.MessageBox.expects().wait(TypeOf.isA(String));
  Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(opts).andStub(
      function() {
        assertEquals('url from opts', staticUrl, opts.url);
      });
  data_model.postToRecord(1, opts);
  mc.verify();
}

function testPostToRecordCallback() {
  var result = null, opts = null, id = 1;
  var data_model = buildDataModel();

  function bridge() {
    if(opts.waitMsg !== false) {
      Ext.MessageBox.expects().wait(TypeOf.isA(String));
    }
    Ext.Ajax.expectsCall('jsonRequest', mc).withArgs(TypeOf.isA(Object)).andStub(
        function() {
          opts.callback.call(opts.scope, result, opts);
        });
    if(opts.waitMsg !== false) {
      Ext.MessageBox.expects().updateProgress(1);
      Ext.MessageBox.expects().hide();
    }
  }

  // request failed
  opts = {};
  result = { success: false };
  bridge();
  opts.expectsCall('callback', mc).withArgs(false, opts.record, result);
  SWorks.ErrorHandling.expectsCall('serverError', mc).withArgs(result);
  data_model.postToRecord(opts);
  mc.verify();

  // record passed in
  opts = { record: new data_model.recordType({id: id, name: 'way cool!'}, id) };
  result = { success: true, data: { id: id, name: 'new data' }};
  bridge();
  opts.store = {};
  opts.store.expectsCall('getById').withArgs(opts.record.id).andStub(
      function() { return opts.record });
  opts.expectsCall('callback', mc).withArgs(true, opts.record, result);
  data_model.expectsEvent('save', mc).withArgs(opts.record, result).andStub(
      function(r) {
        assertEquals('updated record', opts.record.data.name, result.data.name);
      });
  data_model.postToRecord(opts);
  assertFalse('clears newBeforeSave', opts.record.newBeforeSave);
  mc.verify();

  // record passed in, without a store, and no data returned
  opts = { record: new data_model.recordType({id: id, name: 'way cool!'}, id) };
  result = { success: true };
  bridge();
  opts.expectsCall('callback', mc).withArgs(true, opts.record, result);
  data_model.expectsEvent('save', mc).withArgs(opts.record, result);
  data_model.postToRecord(opts);
  mc.verify();

  // no record passed in
  opts = {};
  result = { success: true, objectid: id };
  bridge();
  data_model.expectsEvent('save', mc).withArgs(TypeOf.isA(data_model.recordType), result).
      andStub(function(r) {
        assertEquals('created with correct id', id, r.id);
      });
  data_model.postToRecord(id, opts);
  mc.verify();
}
