/*globals Ext, SWorks, console */
/*jslint glovar: true, undef: true, nomen: true */

Ext.namespace('SWorks');

SWorks.DialogEditor = Ext.extend(Ext.Window, {
  width: 500,
  height: 300,
  autoCreate: true,
  modal: true,
  closable: false,
  resizable: true,
  draggable: true,
  collapsible: false,
  title: 'Edit',
  layout: 'fit',

  initComponent: function() {
    Ext.apply(this, {
      buttons: [{
        text: "Save",
        handler: this.onClickSave,
        scope: this
      }, {
        text: "Close",
        handler: this.onClickClose,
        scope: this
      }],
      keys: [
        { key: 27, fn: this.onClickClose, scope: this },
        { key: Ext.EventObject.ENTER, fn: this.onClickSave, scope: this }
      ]
    });

    SWorks.DialogEditor.superclass.initComponent.call(this);

    this.formPanel = this.findByType('form')[0];
    this.formPanel.border = false;
    this.formPanel.bodyStyle = "padding:10px";
    this.form = this.formPanel.form;

    this.on('hide', this.onHideDialog, this);

    if (this.autoClose !== false) {
      this.form.on('actioncomplete', this.closeOnSaveHandler, this);
    }
  },

  loadRecord: function(record) {
    if(!this.rendered) {
      this.render(Ext.getBody());
    }

    // This can't be done in afterRender because the form won't have
    // been rendered yet, just the window
    this.controller.initFormIdempotent(this.form, this);

    if(this.controller.dataModel.loadForm(this.form, record)) {
      var saveBtn = this.buttons[0];

      if( this.controller.isReadOnly(this.form) === true ) {
        this.formPanel.el.addClass('read-only');
        saveBtn.disable();
      } else {
        this.formPanel.el.removeClass('read-only');
        saveBtn.enable();
      }
      this.show();
    }

    return this.form;
  },

  onHideDialog: function() {
    this.keyMap.disable();
  },

  onClickSave: function(trigger, e) {
    if(this.isFormButtonTrigger(trigger, e)) {
      this.controller.saveForm(this.form, {
        saveButton: true
      });
    }
  },

  closeOnSaveHandler: function(form, action) {
    if (action.options.saveButton == true) {
      this.hide();
    }
  },

  onClickClose: function(trigger, e) {
    if(this.isFormButtonTrigger(trigger, e)) {
      this.hide();
    }
  },

  isFormButtonTrigger: function(trigger, e) {
    //Only function as a button handler on buttons, this makes
    //sure ENTER still works on other buttons and textareas
    //
    var list = [ 'button', 'textarea' ];
    return (typeof trigger == 'object' || list.indexOf(e.target.type) == -1);
  }

});
