/*globals Ext, CSRFKiller */

/*
 *   var CSRFKiller = {
 *     "field": "<%= request_forgery_protection_token %>",
 *     "token": "<%= form_authenticity_token %>"
 *   }
 */

Ext.onReady(function() {
  if(typeof CSRFKiller != 'undefined' && CSRFKiller.field) {
    Ext.Ajax.on('beforerequest', function(conn, options) {
      if(typeof options.params == 'object') {
        //Make the two possibilities easier
        options.params = Ext.urlEncode(options.params);
      } 

      if(options.params && typeof options.params == "string") {
        options.params = options.params+'&'+CSRFKiller.field+'='+CSRFKiller.token;
      } else if(typeof options.params == 'undefined' && options.form) {
        options.params = CSRFKiller.field+'='+CSRFKiller.token;
      }
    });
  }
});
