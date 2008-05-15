/*globals Ext, SWorks, ds */

Ext.namespace('Ext.ux.data', 'SWorks');

Ext.override(Ext.data.Store, {
  // Their load records function isn't very extensible,
  // so I had to copy it in here
  loadRecords : function(o, options, success){
    if(!o || success === false){
        if(success !== false){
            this.fireEvent("load", this, [], options);
        }
        if(options.callback){
            options.callback.call(options.scope || this, [], options, false);
        }
        return;
    }
    var r = o.records, t = o.totalRecords || r.length;
    if(!options || options.add !== true){
        if(this.pruneModifiedRecords){
            this.modified = [];
        }
        for(var i = 0, len = r.length; i < len; i++){
            r[i].join(this);
        }
        if(this.snapshot){
            this.data = this.snapshot;
            delete this.snapshot;
        }
        this.data.clear();
        this.data.addAll(r);
        this.totalLength = t;

        this.onDataChanged(); //This line added

        this.fireEvent("datachanged", this);
    }else{
        this.totalLength = Math.max(t, this.data.length+r.length);
        this.add(r);
    }

    this.fireEvent("load", this, r, options);
    if(options.callback){
        options.callback.call(options.scope || this, r, options, true);
    }
  },
  onDataChanged: function() {
    this.applySort();
  },
  isLoaded: function() {
    return (this.lastOptions !== null);
  },
  whenLoaded: function(fn, scope) {
    if (this.isLoaded()) {
      fn.call(scope);
    } else if(!this.proxy.activeRequest) {
      this.on('load', fn, scope, {single:true});
      this.load();
    }
  }
});

Ext.override(Ext.data.SimpleStore, {
  isLoaded: function() {
    return true;
  }
});

// Add cloning and mirroring ability
Ext.override(Ext.data.Store, {
  clone: function clone(keepFilters, legacy) {
    if(typeof legacy != 'undefined') {
      console.error('Legacy usage of Ext.data.Store.clone(), please fix.');
      return;
    }

    // Never mess with a dirty data store
    if (this.modified.length > 0) {
      console.error('Tried to clone a dirty data store.');
      return;
    }

    var newObj = {};
    Ext.apply(newObj, this);
    delete newObj.clones;

    newObj.resetEvents();
    newObj.mirror(this);

    if(!keepFilters) {
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
      this.data = this.snapshot;
      this.onDataChanged();

      this.fireEvent("datachanged", this);
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
      this.onDataChanged();

      // Anytime you call onDataChanged, you MUST fire datachanged
      this.fireEvent("datachanged", this);

      // Our listeners only care if this record is in our dataset
      // right now. Unlike other events, people will be listening
      // for changes to this specific record, this will cause a
      // minor redundant UI update, but it's not bad and we can't
      // avoid it
      if(this.indexOf(record) != -1) {
        this.fireEvent('update', this, record, type);
      }
    }, this);
    source.on('metachange', function(grid, meta) {
      this.onMetaChange(meta, grid.recordType, null);
    }, this);

    this.relayEvents(source, ['load']);

    // By creating a delegate based on the source's method,
    // if the source is also a clone, the delegate call
    // will have no effect on the scope in which the real
    // code executes because a delegate method ignores any
    // scope applied to it. In this way, only base stores
    // will have their real methods called
    this.addSorted = source.addSorted.createDelegate(source);
    this.add = source.add.createDelegate(source);
    this.remove = source.remove.createDelegate(source);
    this.load = source.load.createDelegate(source);
    this.reload = source.reload.createDelegate(source);
    this.isLoaded = source.isLoaded.createDelegate(source);

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
    if(!this.refreshTask && !(this.mirrorSource && this.mirrorSource.refreshTask)) {
      this.createRefreshTask(this.refreshPeriod);
    }
  }, store);
};
Ext.ux.data.ReloadingStore.scheduleReload = function(store) {
  // This causes the periodic reloads to not hammer the CPU so hard with UI refreshes
  // It only reload a store every 5 seconds, although each store only schedules itself
  // for reload every 5min. Previously all the stores would reload at the sametime and
  // it would peg the cpu for upto 30sec.
  if(!this.reloadTask) {
    var reloadPeriod = 5000;
    this.reloadQueue = [];
    this.reloadTask = new Ext.util.DelayedTask(function() {
      this.reloadTask.delay(reloadPeriod);
      var store = this.reloadQueue[0];
      if(!this.disabled && store) {
        this.reloadQueue = this.reloadQueue.slice(1);
        store.reload();
      }
    }, this);
    this.reloadTask.delay(reloadPeriod);
  }

  if(this.reloadQueue.indexOf(store) == -1) {
    this.reloadQueue.push(store);
  }
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
        (!(this.refreshTask || (this.mirrorSource && this.mirrorSource.refreshTask)) || !this.isLoaded())) {
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

    this.on('beforeload',function() {
      if(this.refreshTask) {
        // Someone might remove it
        this.refreshTask.delay(refreshRate);
      }
    }, this);

    this.refreshTask.setRefreshRate = function(newRate) {
      refreshRate = newRate;
      this.delay(refreshRate);
    };

    this.refreshTask.delay(refreshRate, function(){
      Ext.ux.data.ReloadingStore.scheduleReload(this);
    }, this);
    return this.refreshTask;
  }
};

Ext.ux.data.PersistentFilters = function(store) {
  Ext.apply(store, Ext.ux.data.PersistentFilters.overrides);
};
Ext.ux.data.PersistentFilters.overrides = {
  onDataChanged: function() {
    // Anytime you call onDataChanged, you MUST fire datachanged, otherwise
    // your data structures tracking the dom elements will be out of sync with
    // your store you'll start to have visual update artifacts
    this.applyFilters(false);
    this.applySort();
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
    this.applyFilters();
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

    if (typeof fn != 'function') {
      throw "Unable to add filter: function undefined";
    }

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

ds = Ext.StoreMgr;

SWorks.CrudStore = function(config, custom) {
  if (typeof config == 'string') {
    var clone = Ext.StoreMgr.get(config);
    custom = custom || {};

    config = Ext.applyIf(custom, clone.initialConfig);
  }

  this.initialConfig = config;

  // From JsonStore
  SWorks.CrudStore.superclass.constructor.call(this, Ext.apply({
    proxy: !config.data ? new Ext.data.HttpProxy({
      method: "GET",
      url: config.url
    }) : undefined,
    reader: new Ext.data.JsonReader(config, config.fields)
  }, config));

  Ext.ux.data.LoadAttempts(this);
  Ext.ux.data.ReloadingStore(this);
  Ext.ux.data.PersistentFilters(this);
};
Ext.extend(SWorks.CrudStore, Ext.data.GroupingStore, {
  remoteSort: false,

  linkToParent: function(p, idCol) {
    this.checkParentColumns(idCol);

    p.on('load', function(form, record) {
      if(!p.form || p.form == form) {
        //This deals with polymorphic relations
        this.relation_id = p.form.record.id;
        this.relation_type = p.store.klass; // New records don't have a store

        this.addFilter(this.parentFilter, this);
      }
    }, this);
    p.on('save', function() {
      if(p.form.record) {
        this.relation_id = p.form.record.id;
      }
    }, this);
  },
  filterOnRelation: function(record) {
    //This deals with polymorphic relations
    this.relation_id = record.data.id;
    this.relation_type = record.data.klass || (record.store ? record.store.klass : null);

    this.addFilter(this.parentFilter, this);
  },
  findRelations: function(record) {
    //Searches everything. Quite the hack.
    return this.snapshot.filterBy(this.parentFilter, {
      relation_id: record.data.id,
      relation_type: record.data.klass || (record.store ? record.store.klass : null),
      parentIdColumn: this.parentIdColumn,
      parentTypeColumn: this.parentTypeColumn
    });
  },
  checkParentColumns: function(idCol) {
    if(idCol) {
      this.parentIdColumn = idCol;

      var column = idCol.replace(/id/, "type");
      var value = (this.recordType.prototype.fields.keys.indexOf(column) != -1);

      if(value) {
        this.parentTypeColumn = idCol.replace(/id/, "type");
      } else {
        this.parentTypeColumn = null;
      }
    }
  },
  parentFilter: function(record){
    var idMatch = (record.data[this.parentIdColumn] == this.relation_id);
    var typeMatch = true;

    //Provides automatic filtering on polymophic relations
    if(this.parentTypeColumn) {
      typeMatch = (record.data[this.parentTypeColumn] == this.relation_type);
    }

    return (idMatch && typeMatch);
  }
});

SWorks.SearchStore = function(config, custom) {
  if (typeof config == 'string') {
    var clone = Ext.StoreMgr.get(config);
    custom = custom || {};

    config = Ext.applyIf(custom, clone.initialConfig);
  }

  this.initialConfig = config;

  SWorks.SearchStore.superclass.constructor.call(this, Ext.apply({
    proxy: new Ext.data.HttpProxy({
      method: "GET",
      url: config.url
    }),
    reader: new Ext.data.JsonReader(config, config.fields)
  }, config));

  this.querySet = {};

  Ext.ux.data.LoadAttempts(this);
};
Ext.extend(SWorks.SearchStore, Ext.data.GroupingStore, {
  queryParam: 'q',
  allQuery: 'id:*',
  mode: 'remote',
  remoteSort: true,
  groupOnSort: true,
  groupField: false,

  addFilter: function(name, query) {
    this.querySet[name] = query;
  },

  removeFilter: function(name) {
    delete this.querySet[name];
  },

  load: function(options) {
    options = options || {};
    options.params = options.params || {};
    var query = options.params[this.queryParam];

    if(typeof query == 'undefined') {
      //reload on anything that uses lastOptions needs to bypass this, if you have
      //a one off query you'll bypass it also
      var qs = this.querySet, queryList = (typeof query == 'undefined') ? [] : [ query ];

      for (var i in qs) if (typeof qs[i] == 'string') {
        queryList.push(qs[i]);
      }
      if (queryList.length > 0) {
        query = queryList.join(' AND ');
      } else {
        query = 'id:*';
      }

      options.params[this.queryParam] = query;
    }

    SWorks.SearchStore.superclass.load.call(this, options);
  }
});

