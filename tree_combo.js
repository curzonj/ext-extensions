/* Mostly copied from combo boxes. TreeComboBox currently depends on
 * DataStoreBacking in multiple ways and requires a data store. I could
 * fix that you need me to. nodes is a config parameter passed to the
 * DataStoreBacking.
 *
 * Example:
 *   items: [new TreeComboBox({
 *           //Required, non-standard parameters
 *             nodes: {
 *               store: locations_ds,
 *               textField: 'title'
 *             },
 *           //Parameters that function exactly like the ComboBox
 *             fieldLabel: 'Location',
 *             hiddenName: 'portion[location_id]',
 *             dataIndex: 'location_id',
 *             displayField: 'full_title',
 *             valueField: 'id',
 *             allowBlank: false,
 *             width: 280,
 *             resizable: true,
 *           }), {
 */
var TreeComboBox = Ext.extend(Ext.form.TriggerField, {
  valueNotFoundText: "Item not found",
  defaultAutoCreate : {tag: "input", type: "text", size: "24", autocomplete: "off"},
  listClass: '',
  selectedClass: 'x-combo-selected',
  triggerClass : 'x-form-arrow-trigger',
  shadow:'sides',
  listAlign: 'tl-bl?',
  maxHeight: 300,
  resizable: false,
  handleHeight : 8,
  minListWidth : 70,
  // If you use lazyInit, the user won't have any indication that
  // the tree is loading it's data. TODO maybe we need a loading
  // mask
  lazyInit : false,

  initComponent : function(){
    TreeComboBox.superclass.initComponent.call(this);
    this.addEvents({
      'expand' : true,
      'collapse' : true,
      'beforeselect' : true,
      'select' : true
    });
    this.selectedNode = -1;

    if(!this.tree) {
      var root = { id: 'root' };
      if(this.allowBlank) {
        root['text'] = 'Root level';
        root['expanded'] = true;
      }

      if (this.store)
        this.nodes.store = this.store;
      
      this.tree = new Ext.tree.TreePanel({
        plugins: new Ext.ux.tree.DataStoreBacking(this.nodes),
        animate: false,
        rootVisible: this.allowBlank,
        autoScroll: true,
        border: false,
        root: new Ext.tree.TreeNode(root)
      });
    }
  },

  onRender : function(ct, position){
    TreeComboBox.superclass.onRender.call(this, ct, position);
    if(this.hiddenName){
      this.hiddenField = this.el.insertSibling({tag:'input', type:'hidden', name: this.hiddenName, id: (this.hiddenId||this.hiddenName)},
              'before', true);
      this.hiddenField.value =
          this.hiddenValue !== undefined ? this.hiddenValue :
          this.value !== undefined ? this.value : '';

      this.el.dom.removeAttribute('name');
    }

    this.el.dom.setAttribute('readOnly', true);
    this.el.on('mousedown', this.onTriggerClick,  this);
    this.el.addClass('x-combo-noedit');

    if(!this.lazyInit){
        this.initList();
    }else{
        this.on('focus', this.initList, this, {single: true});
    }
  },

  initList : function(){
    if(!this.list){
      var cls = 'x-combo-list';

      this.list = new Ext.Layer({
          shadow: this.shadow, cls: [cls, this.listClass].join(' '), constrain:false
      });

      var lw = this.listWidth || Math.max(this.wrap.getWidth(), this.minListWidth);
      this.list.setWidth(lw);
      this.assetHeight = 0;

      if(this.title){
          this.header = this.list.createChild({cls:cls+'-hd', html: this.title});
          this.assetHeight += this.header.getHeight();
      }

      this.innerList = this.list.createChild({cls:cls+'-inner'});
      this.innerList.setWidth(lw - this.list.getFrameWidth('lr'))

      this.tree.render(this.innerList);
      this.tree.on('dblclick', this.onSelect, this);
      new Ext.tree.TreeSorter(this.tree, {folderSort: true});
      
      this.restrictHeight();

      if(this.resizable){
        this.resizer = new Ext.Resizable(this.list,  {
          pinned:true, handles:'se'
        });
        this.resizer.on('resize', function(r, w, h){
          this.maxHeight = h-this.handleHeight-this.list.getFrameWidth('tb')-this.assetHeight;
          this.listWidth = w;
          this.innerList.setWidth(w - this.list.getFrameWidth('lr'));
          this.restrictHeight();
        }, this);
        this['innerList'].setStyle('margin-bottom', this.handleHeight+'px');
      }
    }
  },

  initEvents : function(){
    TreeComboBox.superclass.initEvents.call(this);

    this.keyNav = new Ext.KeyNav(this.el, {
      "esc" : function(e){
        this.collapse();
      },

      scope : this,

      doRelay : function(foo, bar, hname){
        if(hname == 'down' || this.scope.isExpanded()){
         return Ext.KeyNav.prototype.doRelay.apply(this, arguments);
        }
        return true;
      },

      forceKeyDown : true
    });
  },

  onDestroy : function(){
    if(this.view){
      this.view.el.removeAllListeners();
      this.view.el.remove();
      this.view.purgeListeners();
    }
    if(this.list){
      this.list.destroy();
    }
    TreeComboBox.superclass.onDestroy.call(this);
  },

  onResize: function(w, h){
    TreeComboBox.superclass.onResize.apply(this, arguments);
    if(this.list && this.listWidth === undefined){
      var lw = Math.max(w, this.minListWidth);
      this.list.setWidth(lw);
      this.innerList.setWidth(lw - this.list.getFrameWidth('lr'));
    }
  },

  onDisable: function(){
    TreeComboBox.superclass.onDisable.apply(this, arguments);
    if(this.hiddenField){
      this.hiddenField.disabled = this.disabled;
    }
  },

  onSelect : function(node, e){
    if(this.fireEvent('beforeselect', this, node, e) !== false){
      this.setValue(node);
      this.collapse();
      this.fireEvent('select', this, node, e);
    }
  },
    
  getValue : function(){
    if(this.valueField){
      return typeof this.value != 'undefined' ? this.value : '';
    }else{
      return TreeComboBox.superclass.getValue.call(this);
    }
  },

  clearValue : function(){
    if(this.hiddenField){
      this.hiddenField.value = '';
    }
    this.setRawValue('');
    this.lastSelectionText = '';
    this.applyEmptyText();
  },
  
  setValue : function(v){
    var node = null;
    if(v && v.attributes) {
      node = v;
      if(node.isRoot) {
        v = null;
      } else {
        v = node.attributes.record.data[this.valueField || this.displayField];
      }
    }

    var text = v;
    // Everything is build to have a value field, it should mostly work
    // without one
    if(this.valueField && v){
      if(!node)
        node = this.tree.findNodeBy(this.nodeMatch.createDelegate(this, [v], true));

      if(node) {
        this.node = node;
        text = node.attributes.record.data[this.displayField];
        this.selectNode(node);
      } else {
        text = this.valueNotFoundText;
      }
    }

    if(!v && this.tree.rootVisible) {
      this.selectNode(this.tree.root);
    }

    this.lastSelectionText = text;
    if(this.hiddenField){
      this.hiddenField.value = v;
    }
    TreeComboBox.superclass.setValue.call(this, text);
    this.value = v;
  },

  nodeMatch: function(node, value) {
    return (node.attributes.record && node.attributes.record.data &&
            node.attributes.record.data[this.valueField] == value);
  },

  selectNode: function(node) {
    if(node.parentNode) {
      var path = node.parentNode.getPath();

      this.tree.collapseAll();
      this.tree.expandPath(path);
    }

    node.select();
  },

  restrictHeight : function(){
    var fw = this.list.getFrameWidth('tb');
    this.innerList.setHeight(this.maxHeight);
    this.list.beginUpdate();
    this.list.setHeight(this.innerList.getHeight()+fw+(this.resizable?this.handleHeight:0)+this.assetHeight);
    this.list.alignTo(this.el, this.listAlign);
    this.list.endUpdate();
  },

  isExpanded : function(){
    return this.list && this.list.isVisible();
  },

  collapse : function(){
    if(!this.isExpanded()){
      return;
    }
    this.list.hide();
    Ext.getDoc().un('mousewheel', this.collapseIf, this);
    Ext.getDoc().un('mousedown', this.collapseIf, this);
    this.fireEvent('collapse', this);
  },

  collapseIf : function(e){
    if(!e.within(this.wrap) && !e.within(this.list)){
      this.collapse();
    }
  },

  expand : function(){
    if(this.isExpanded() || !this.hasFocus){
      return;
    }
    this.list.alignTo(this.wrap, this.listAlign);
    this.list.show();
    Ext.getDoc().on('mousewheel', this.collapseIf, this);
    Ext.getDoc().on('mousedown', this.collapseIf, this);
    this.fireEvent('expand', this);
  },

  onTriggerClick : function(){
    if(this.disabled){
      return;
    }
    if(this.isExpanded()){
      this.collapse();
      this.el.focus();
    }else {
      this.onFocus({});
      this.expand();
      this.el.focus();
    }
  }
});
Ext.reg('treecombo', TreeComboBox);
