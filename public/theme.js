// Applies the saved theme before first paint. Default follows the system; the toggle overrides it.
// Storage can throw (private windows, blocked site data), so every access is guarded.
(function(){
 var saved=null;try{saved=localStorage.getItem('jf-theme');}catch(e){}
 var light=saved?saved==='light':!!(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches);
 document.documentElement.dataset.theme=light?'light':'dark';
})();
