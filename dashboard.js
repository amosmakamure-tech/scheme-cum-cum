/* Scheme-Cum-Plan Builder — dashboard logic */
(function () {
'use strict';
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
var me = Auth.current();
if (!me) { location.href = 'login.html'; return; }
document.getElementById('dashWelcome').textContent = 'Welcome, ' + me.name;

function completeness(rows) {
  if (!rows.length) return 0;
  var need = ['topic', 'objK', 'indicators', 'refCode', 'hook', 'closure', 'obs', 'assessMethod', 'criteria'];
  var got = 0, total = rows.length * need.length;
  rows.forEach(function (r) {
    need.forEach(function (f) { if (r[f] && String(r[f]).trim()) got++; });
  });
  return Math.round((got / total) * 100);
}

function render() {
  var lib = Store.loadLib();
  var docs = Store.repoMeta().length;
  var entries = 0;
  lib.schemes.forEach(function (s) { entries += (s.rows || []).length; });
  document.getElementById('statSchemes').textContent = lib.schemes.length;
  document.getElementById('statEntries').textContent = entries;
  document.getElementById('statDocs').textContent = docs;
  var active = null;
  lib.schemes.forEach(function (s) { if (s.id === lib.activeId) active = s; });
  document.getElementById('statComplete').textContent = active ? completeness(active.rows || []) + '%' : '0%';

  var tb = document.getElementById('schemeRows');
  if (!lib.schemes.length) {
    tb.innerHTML = '<tr><td colspan="6" class="hint">No schemes yet. Click "+ New scheme" to start one.</td></tr>';
    return;
  }
  tb.innerHTML = lib.schemes.map(function (s) {
    var o = s.ov || {};
    return '<tr><td><strong>' + esc(s.name) + '</strong>' +
      (s.id === lib.activeId ? ' <span class="badge syllabus">active</span>' : '') + '</td>' +
      '<td>' + esc(o.subject || '') + '</td>' +
      '<td>' + esc(o.grade || '') + ' / Term ' + esc(o.term || '') + '</td>' +
      '<td>' + (s.rows || []).length + '</td>' +
      '<td>' + esc(s.updated || '') + '</td>' +
      '<td><button type="button" class="link-btn" data-dopen="' + s.id + '">Open</button>' +
      '<button type="button" class="link-btn" data-ddup="' + s.id + '">Duplicate</button>' +
      '<button type="button" class="link-btn" data-dren="' + s.id + '">Rename</button>' +
      '<button type="button" class="link-btn" data-ddel="' + s.id + '">Delete</button></td></tr>';
  }).join('');
}

document.getElementById('schemeRows').addEventListener('click', function (e) {
  function attr(el, a) { var b = el.closest ? el.closest('[' + a + ']') : null; return b ? b.getAttribute(a) : null; }
  var id = attr(e.target, 'data-dopen') || attr(e.target, 'data-ddup') ||
           attr(e.target, 'data-dren') || attr(e.target, 'data-ddel');
  if (!id) return;
  var lib = Store.loadLib();
  var s = null;
  lib.schemes.forEach(function (x) { if (x.id === id) s = x; });
  if (!s) return;
  if (attr(e.target, 'data-dopen')) {
    lib.activeId = id;
    Store.saveLib(lib);
    location.href = 'app.html';
  } else if (attr(e.target, 'data-ddup')) {
    var copy = JSON.parse(JSON.stringify(s));
    copy.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    copy.name = s.name + ' (copy)';
    Store.touch(copy);
    lib.schemes.push(copy);
    Store.saveLib(lib);
    render();
  } else if (attr(e.target, 'data-dren')) {
    var name = prompt('Scheme name:', s.name);
    if (name && name.trim()) {
      s.name = name.trim();
      Store.touch(s);
      Store.saveLib(lib);
      render();
    }
  } else if (attr(e.target, 'data-ddel')) {
    if (!confirm('Delete "' + s.name + '" and all its entries?')) return;
    lib.schemes = lib.schemes.filter(function (x) { return x.id !== id; });
    if (lib.activeId === id) lib.activeId = lib.schemes.length ? lib.schemes[0].id : null;
    Store.saveLib(lib);
    render();
  }
});

document.getElementById('btnNewScheme').addEventListener('click', function () {
  var name = prompt('Name for the new scheme (e.g. Shona Grade 5 Term 2):');
  if (!name || !name.trim()) return;
  var lib = Store.loadLib();
  var s = Store.blankScheme(name.trim());
  lib.schemes.push(s);
  lib.activeId = s.id;
  Store.saveLib(lib);
  location.href = 'app.html';
});

document.getElementById('btnLogout').addEventListener('click', function () {
  Auth.logout();
  location.href = 'login.html';
});

render();
})();
