/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks');

SWorks.ErrorHandling = {
  serverError: function(result) {
    console.trace();
    if(typeof result !== 'object' || result.serverErrorDispatched !== true) {
      var msg = (typeof result === 'object' &&
                 typeof result.message == 'string' ? result.message : null ) || 
                  "The server had a problem. Please report the issue.";

      Ext.MessageBox.alert('Error', msg);

      if (typeof result == 'object') {
        result.serverErrorDispatched = true;
      }
    }
  },
  clientError: function(message) {
    message = typeof message == 'string' ? message :
      "There was an internal error. Please report the issue and reload the application.";

    console.trace();
    Ext.MessageBox.alert('Application Error', message);
  },
  onAjaxRequestComplete: function(conn, resp, opts) {
    this.addData([true, resp, opts]);
    var result = null;
    try {
      result =  Ext.decode(resp.responseText);
      if (typeof result === 'object' && result.success === false) {
        this.serverError(result);
        this.logError(resp, opts);
      }
    } catch(e) {
      console.error("Failed to parse response ("+resp.tId+"): " + e.message);
    }
  },

  onAjaxRequestException: function(conn, resp, opts) {
    this.addData([false, resp, opts]);
    //resp.status == HTTP status code
    if(resp.status === 0) {
      Ext.MessageBox.alert('Server Not Found',
            "Failed to connect to the server.  Please report the issue.");
    } else {
      if (resp.status == -1) {
        var m = opts.method;
        if ((!m || m === '' || m == 'GET' || opts.forceRetryRequest === true) &&
            (typeof opts.retryAttempts != 'number' || opts.retryAttempts > 0)) {
          // if retryAttempts == null, set = 1 and try which gives 1 more
          // retry after this, so retryAttempts == null gets 2 retrys
          opts.retryAttempts = (typeof opts.retryAttempts == 'number') ?
                  opts.retryAttempts - 1 : 1;
          Ext.Ajax.request(opts);

          return false; // halt the error propogation
        } else {
          Ext.MessageBox.alert('Error',
              "The server was too slow. The request may or may not have completed.");
        }
      } else {
        this.serverError();
        this.logError(resp, opts);
      }
    }
  },
  saveSerializedFormData: function(conn, options) {
    if(options.form) {
      options.serializedForm = Ext.lib.Ajax.serializeForm(options.form);
    }
  },
  logError: function(response, options) {
    if(options.loggingRequest !== true) {
      var data = {
        serverResponse: response,
        clientRequest: {
          url: options.url,
          parameters: options.params,
          formData: options.serializedForm
        }
      };

      if (options.scope &&
          options.scope.options &&
          options.scope.options.dataSentRecord) {
        data.clientRequest.dataRecord = options.scope.options.dataSentRecord;
      }

      SWorks.Logging.error(data);
    }
  },
  addData: function(list) {
    this.dataList.push(list);
    if(this.dataList.length > 100) {
      this.dataList.pop();
    }
  },
  onExtReady: function() {
    this.dataList = this.dataList || [];

    Ext.Ajax.on('beforerequest', this.saveSerializedFormData, this);
    Ext.Ajax.on('requestcomplete', this.onAjaxRequestComplete, this);
    Ext.Ajax.on('requestexception', this.onAjaxRequestException, this);
  }
};

Ext.onReady(SWorks.ErrorHandling.onExtReady, SWorks.ErrorHandling);

Ext.override(Ext.data.Connection, {
  handleJsonResponse: function(options, success, response) {
    var result = null;
    if(success) {
      try {
      result =  Ext.decode(response.responseText);
      } catch(e) {}

      if (result && typeof result === 'object') {
        if(options.jsonCallback &&
          typeof options.jsonCallback.callback == 'function') {

          options.jsonCallback.callback.call(
            options.jsonCallback.scope,
            result, options);
        }
      } else {
        SWorks.ErrorHandling.serverError();
      }
    }
  },
  jsonRequest: function(opts) {
    opts.jsonCallback = {
      callback: opts.callback,
      scope: opts.scope
    };
    opts.callback = this.handleJsonResponse;

    this.request(opts);
  }
});
