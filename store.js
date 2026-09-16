/* Scheme-Cum-Plan Builder — per-profile storage + scheme library (shared by app + dashboard) */
var Store = (function () {
'use strict';
function pid() {
  try {
    var p = Auth.current();
    return p ? p.id : 'local';
  } catch (e) { return 'local'; }
}
function key(base) { return 'scpb-' + pid() + '-' + base; }
function blankScheme(name) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name || 'My Scheme-Cum-Plan',
    updated: new Date().toISOString().slice(0, 10), ov: null, rows: [] };
}
function loadLib() {
  var lib = null;
  try { lib = JSON.parse(localStorage.getItem(key('lib')) || 'null'); } catch (e) {}
  if (!lib || !Array.isArray(lib.schemes)) lib = { schemes: [], activeId: null };
  return lib;
}
function saveLib(lib) {
  try { localStorage.setItem(key('lib'), JSON.stringify(lib)); } catch (e) {}
}
function touch(s) { s.updated = new Date().toISOString().slice(0, 10); }
function repoMeta() {
  try {
    var m = JSON.parse(localStorage.getItem(key('repometa')) || 'null');
    if (Array.isArray(m)) return m;
  } catch (e) {}
  return [];
}
function saveRepoMeta(list) {
  try { localStorage.setItem(key('repometa'), JSON.stringify(list)); } catch (e) {}
}
return { pid: pid, key: key, blankScheme: blankScheme, loadLib: loadLib, saveLib: saveLib,
         touch: touch, repoMeta: repoMeta, saveRepoMeta: saveRepoMeta };
})();
