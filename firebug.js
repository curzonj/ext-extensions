if(typeof console == 'undefined') {
  console = { firebug: 'dummy' }
  (function() {
    var list = ['error','assert','count','debug','dir','dirxml','group','groupEnd','info','log','profile','profileEnd','time','timeEnd','trace','warn'];

    for(var i=0;i<list.length;i++) {
      var name = list[i];
      if(!console[name]) {
        console[name] = function() {};
      }
    }
  })();
}
