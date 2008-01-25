/*globals Ext */

// Add cloning and mirroring ability
Ext.override(Ext.data.Store, {
  clone: function clone(keep_filters, mirror_data) {
    // Never mess with a dirty data store
    if (this.modified.length > 0) {
      return;
    }

    var newObj = {};
    Ext.apply(newObj, this);
    newObj.resetEvents();

    if(mirror_data !== false) {
      newObj.mirror(this);
    } else {
      //We start out with the same instance of data, and load()
      //just clears the items from the data collection and puts
      //new ones in. This gives us our own records and our own
      //instance of data.
      newObj.initData();
    }

    if(!keep_filters) {
      newObj.filterChain = [];
    }

    return newObj;
  },
  initData: function() {
    this.data = new Ext.util.MixedCollection(false);
    this.data.getKey = function(o){
        return o.id;
    };
  },
  mirror: function(source) {
    // Mirrored data stores only work for a limited subset of the total
    // uses of datastores. Consider them carefully before using them.
    if(source.mirrorSource) {
      this.mirrorSource = source.mirrorSource;
    } else {
      this.mirrorSource = source;
    }

    source.clones = source.clones || [];
    source.clones.push(this);

    var update = function() {
      this.snapshot = source.snapshot || source.data;
      this.applyFilters();
    };

    //The index from add/remove won't match with ours and
    //we may not want their records anyways, so we have to
    //call applyFilters and we have to fire datachanged
    //If you try and call this.add(record) with source.on('add'
    //you'll get a loop because of the delegates below. The
    //delegates are essential to make sure updated data gets
    //updated in all the mirrored trees
    source.on('add', update, this);
    source.on('remove', update, this);
    source.on('datachanged', update, this);
    source.on('update', function(store, record, type) {
      // If it's attributes have changed, it's filter conditions
      // might have changed
      this.applyFilters();
      // Our listeners only care if this record is in our dataset
      // right now. Unlike other events, people will be listening
      // for changes to this specific record
      if(this.indexOf(record) != -1) {
        this.fireEvent('update', store, record, type);
      }
    }, this);

    this.relayEvents(source, ['load']);

    // By creating a delegate based on the source's method,
    // if the source is also a clone, the delegate call
    // will have no effect on the scope in which the real
    // code executes because a delegate method ignores any
    // scope applied to it. In this way, only base stores
    // will have their real methods called
    this.add = source.add.createDelegate(source);
    this.remove = source.remove.createDelegate(source);
    this.load = source.load.createDelegate(source);
    this.reload = source.reload.createDelegate(source);

    this.onMirror(source);
  },
  onMirror: function(source) {
    // For overriding via config options or inheritance
  }
});

// Better mask handling
Ext.override(Ext.grid.GridPanel, {
  afterRender_without_maskHandling: Ext.grid.GridPanel.prototype.afterRender,
  afterRender: function() {
    this.afterRender_without_maskHandling();

    if( this.store.proxy &&
        this.store.proxy.activeRequest &&
        !this.store.totalLength &&
        this.loadMask) {
      this.loadMask.show();
    } else if(this.loadMask &&
              this.loadMask.removeMask &&
              this.store.totalLength){
      // If the store is loaded already,
      // remove the mask
      this.loadMask.destroy();
    }
  }
});

Ext.ux.data.LoadAttempts = function(store, maxAttempts) {
  maxAttempts = maxAttempts || 5;

  store.loadAttempts = 0;
  store.maxAttempts = maxAttempts;

  if(store.proxy) {
    store.proxy.on('loadexception', function(proxy, data, transaction) {
      store.loadAttempts = store.loadAttempts ? store.loadAttempts + 1 : 1;
      if (store.loadAttempts < maxAttempts) {
        store.reload();
      }
    }, store);
  }

  store.on('load', function() {
    store.loadAttempts = 0;
  }, store);
};

Ext.ux.data.ReloadingStore = function(store) {
  store.mirror_without_reloading = store.mirror;
  Ext.apply(store, Ext.ux.data.ReloadingStore.overrides);

  store.on('beforeload', function() {
    this.createRefreshTask(this.refreshPeriod);
  }, store, {single:true});
};
Ext.ux.data.ReloadingStore.overrides = {
  refreshPeriod: 360000,
  loadIfNeeded: function() {
    if(!(this.proxy &&
         this.proxy.conn &&
         this.proxy.conn.url )) {
      return;
    }

    var data = this.snapshot || this.filteredCache || this.data;
    // If there isn't a request in progress, and
    //    we arn't automatically refreshing the data, or
    //    the data hasn't been loaded yet
    if( !this.proxy.activeRequest &&
        (!(this.refreshTask || (this.mirrorSource && this.mirrorSource.refreshTask)) || data.length === 0)) {
      this.load();
    }
  },
  mirror: function(source) {
    this.mirror_without_reloading(source);
    this.createRefreshTask = source.createRefreshTask.createDelegate(source);
    this.cancelRefreshTask = source.cancelRefreshTask.createDelegate(source);
  },
  cancelRefreshTask: function() {
    if(this.refreshTask) {
      this.refreshTask.cancel();
    }
  },
  createRefreshTask: function(refreshRate) {
    if(!this.proxy || refreshRate <= 0) {
      return;
    }

    if(this.refreshTask) {
      this.refreshTask.cancel();
    }
    //TODO maybe there is a way to not reload the table
    //if there is nothing new
    this.refreshTask = new Ext.util.DelayedTask();
    //If it is manually reloaded, we don't need to
    this.on('beforeload',function() {
      this.refreshTask.delay(refreshRate);
    }, this);
    this.refreshTask.setRefreshRate = function(newRate) {
      refreshRate = newRate;
      this.delay(refreshRate);
    };
    this.refreshTask.delay(refreshRate, function(){
      //Causes ourselves to re-execute
      //Although we could save a reference in this scope to the task
      //and use that instead of going through this, but that causes
      //some wierd issue where it doesn't use thread local storage and
      //multiple refreshTask's screw each other
      this.refreshTask.delay(refreshRate);
      //reload the data. If we fail, we already rescheduled, if we succeed,
      //beforeload will delay the next reload
      if(Ext.ux.data.ReloadingStore.disableReloading !== false) {
        this.reload();
      }
    }, this);
    return this.refreshTask;
  }
};

Ext.ux.data.PersistentFilters = function(store) {
  Ext.apply(store, Ext.ux.data.PersistentFilters.overrides);
};
Ext.ux.data.PersistentFilters.overrides = {
  onDataChanged: function() {
    this.applySort();
    this.applyFilters(false);
  },
  clearFilter: function(suppressEvent) {
    // Just removes the effects of filterBy
    this.filteredCache = this.filteredCache || this.snapshot || this.data;

    if(this.filteredCache && this.filteredCache != this.data){
      this.data = this.filteredCache;
      if(suppressEvent !== true){
        this.fireEvent("datachanged", this);
      }
    }
  },
  purgeFilters: function() {
    this.filterChain = [];
  },
  filterBy: function(fn, scope) {
    this.applyFilters();

    this.data = this.data.filterBy(fn, scope||this);
    this.fireEvent("datachanged", this);
  },
  // I'm not sure we want these results filtered too,
  // but if so, here is how to do it.
/* queryBy: function(fn, scope) {
    var data = this.filterCache || this.snapshot || this.data;
    return data.filterBy(fn, scope||this);
  }, */
  addRegExFilter: function(property, value, anyMatch, caseSensitive) {
    var fn = this.createFilterFn(property, value, anyMatch, caseSensitive);
    if (fn) {
      this.addFilter(fn);
    }
  },
  addFilter: function(fn, scope, suppress_filtering) {
    this.filterChain = this.filterChain || [];

    if(this.findFilter(fn, scope) == -1) {
      this.filterChain.push({
        fn: fn,
        scope: (scope || this)
      });
    }

    if(!suppress_filtering) {
      this.applyFilters();
    }

    return this;
  },
  removeFilter: function(fn, scope, suppress_filtering) {
    var index;
    if((index = this.findFilter(fn, scope)) != -1) {
      this.filterChain.splice(index, 1);

      if(!suppress_filtering) {
        this.applyFilters();
      }
    }
  },
  findFilter: function(fn, scope) {
    //Copied straight from Ext.Event
    scope = scope || this;
    var fc = this.filterChain || [];
    for(var i = 0, len = fc.length; i < len; i++){
        var l = fc[i];
        if(l.fn == fn && l.scope == scope){
            return i;
        }
    }
    return -1;
  },
  applyFilters: function(fire_event) {

    this.snapshot = this.snapshot || this.data;
    this.data = this.snapshot;
    var fc = this.filterChain || [];
    var len = fc.length;

    if(len !== 0) {
      this.data = this.data.filterBy(function(record, id) {
        for(var i=0;i<len;i++) {
          var set = fc[i];
          if(!set.fn.call((set.scope||this), record, id)) {
            return false;
          }
        }
        return true;
      });
    }

    this.filteredCache = this.data;

    if(fire_event !== false) {
      this.fireEvent("datachanged", this);
    }
  }
};
