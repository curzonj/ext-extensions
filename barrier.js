/*globals Ext, SWorks */
/*jslint glovar: true, undef: true, browser: true */

/*
 * barrier = new Barrier({
 *   timeout: 30000, // 30sec
 *   waitsFor: [
 *     { event: 'load', sender: closedAccounts.store },
 *     { event: 'load', sender: openAccounts.store },
 *     { event: 'complete', sender: anotherBarrier },
 *   ],
 *   callback: function(barrier, events) {
 *    // events is an array with the data from the events received and their senders
 *    console.dir(events);
 *   },
 *   scope: this
 * });
 */

Ext.namespace('SWorks');

SWorks.Barrier = function(opts) {
  Ext.apply(this, opts);

  this.addEvents('complete', 'expired');
  this.eventData = [];

  if (this.waitsFor) {
    this.expectedEvents = this.waitsFor.length;
    for(var i=0;i<this.waitsFor.length;i++) {
      var item = this.waitsFor[i];
      item.self = this;

      item.sender.on(item.event, this.eventReceiver, item, {single:true});
    }
  } else {
    // Use createCondition
    this.expectedEvents = 0;
  }

  setTimeout(this.onBarrierExpired.createDelegate(this), this.timeout);
}
Ext.extend(SWorks.Barrier, Ext.util.Observable, {
  timeout: 30000, // 30sec
  callback: Ext.emptyFn,

  eventReceiver: function() {
    var item = this;

    item.self.handleCondition({
      sender: item.sender,
      event: item.event,
      args: Array.prototype.slice.call(arguments, 0)
    });
  },
  handleCondition: function(data) {
    this.eventData.push(data);
    this.checkBarrier();
  },
  checkBarrier: function() {
    if (this.eventData.length == this.expectedEvents) {
      this.complete = true;
      this.callback.call(this.scope || this, true, this.eventData);
      this.fireEvent('complete', this, this.eventData);
    }
  },
  onBarrierExpired: function() {
    if(!this.complete) {
      if (this.waitsFor) {
        for(var i=0;i<this.waitsFor.length;i++) {
          var item = this.waitsFor[i];
          item.sender.un(item.event, this.eventReceiver, item);
        }
      }

      this.callback.call(this.scope || this, false, this.eventData);
      this.fireEvent('expired', this);
    }
  },
  createCondition: function() {
    var self = this;
    this.expectedEvents++;

    return {
      complete: function() {
        self.handleCondition({
          args: Array.prototype.slice.call(arguments, 0)
        });
      }
    };
  }
});

