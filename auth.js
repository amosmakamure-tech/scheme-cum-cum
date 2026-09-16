/* Scheme-Cum-Plan Builder — admin-controlled access (device-local, no server).
   Model:
   - First run: a system ADMIN is created (name + PIN). Only the admin can approve members.
   - Teachers REQUEST access (name). They appear as PENDING until the admin approves
     them and issues a PIN. Teachers log in with the PIN provided by the admin.
   - The admin can LOCK the system: while locked, no teacher can log in (admin can).
   NOTE: data lives in this browser only. The PIN/lock keeps casual users out on a
   shared computer; it is not bank-grade security. */
var Auth = (function () {
'use strict';
var LS_ADMIN = 'scpb-admin';
var LS_PROFILES = 'scpb-profiles';
var SS_SESSION = 'scpb-session';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function hashPin(pin) {
  var h = 5381;
  var s = 'scpb::' + (pin || '');
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}
function validPin(pin) { return (pin || '').length >= 4; }

/* ----- admin ----- */
function loadAdmin() {
  try {
    var a = JSON.parse(localStorage.getItem(LS_ADMIN) || 'null');
    if (a && a.pin) return a;
  } catch (e) {}
  return null;
}
function saveAdmin(a) {
  try { localStorage.setItem(LS_ADMIN, JSON.stringify(a)); } catch (e) {}
}

/* ----- teacher profiles ----- */
function loadProfiles() {
  var list = [];
  try {
    var p = JSON.parse(localStorage.getItem(LS_PROFILES) || 'null');
    if (Array.isArray(p)) list = p;
  } catch (e) {}
  /* grandfather pre-approval profiles as approved */
  return list.map(function (x) {
    return { id: x.id, name: x.name, status: x.status || 'approved',
             pin: x.pin || '', created: x.created || '' };
  });
}
function saveProfiles(list) {
  try { localStorage.setItem(LS_PROFILES, JSON.stringify(list)); } catch (e) {}
}
function findProfile(id) {
  var found = null;
  loadProfiles().forEach(function (p) { if (p.id === id) found = p; });
  return found;
}
/* adopt data saved by the pre-login version into the first approved profile */
function migrateLegacy() {
  var raw = null;
  try { raw = localStorage.getItem('scpb-v1'); } catch (e) {}
  if (!raw) return null;
  try {
    var d = JSON.parse(raw);
    if (d && (d.rows || d.ov)) {
      try { localStorage.removeItem('scpb-v1'); } catch (e2) {}
      try { localStorage.removeItem('scpb-repo-meta'); } catch (e3) {}
      return d;
    }
  } catch (e) {}
  return null;
}

return {
  /* admin */
  hasAdmin: function () { return !!loadAdmin(); },
  setupAdmin: function (name, pin) {
    if (loadAdmin()) return { error: 'An administrator already exists.' };
    name = (name || '').trim();
    if (!name) return { error: 'Enter the administrator name.' };
    if (!validPin(pin)) return { error: 'Admin PIN must be at least 4 digits.' };
    var a = { name: name, pin: hashPin(pin), locked: false };
    saveAdmin(a);
    return { admin: a };
  },
  verifyAdmin: function (pin) {
    var a = loadAdmin();
    if (!a) return { error: 'No administrator set up yet.' };
    if (a.pin !== hashPin(pin || '')) return { error: 'Wrong admin PIN.' };
    return { admin: a };
  },
  isLocked: function () {
    var a = loadAdmin();
    return !!(a && a.locked);
  },
  setLocked: function (locked) {
    var a = loadAdmin();
    if (!a) return;
    a.locked = !!locked;
    saveAdmin(a);
  },
  adminName: function () {
    var a = loadAdmin();
    return a ? a.name : '';
  },

  /* teachers */
  list: loadProfiles,
  pending: function () {
    return loadProfiles().filter(function (p) { return p.status === 'pending'; });
  },
  members: function () {
    return loadProfiles().filter(function (p) { return p.status === 'approved'; });
  },
  requestAccess: function (name) {
    name = (name || '').trim();
    if (!name) return { error: 'Enter your name.' };
    var list = loadProfiles();
    var dup = list.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (dup) return { error: 'That name is already registered.' };
    var profile = { id: uid(), name: name, status: 'pending', pin: '',
                    created: new Date().toISOString().slice(0, 10) };
    list.push(profile);
    saveProfiles(list);
    return { profile: profile };
  },
  approve: function (id, pin) {
    if (!validPin(pin)) return { error: 'Issue a PIN of at least 4 digits.' };
    var list = loadProfiles();
    var found = null;
    list.forEach(function (p) { if (p.id === id) found = p; });
    if (!found) return { error: 'Request not found.' };
    found.status = 'approved';
    found.pin = hashPin(pin);
    saveProfiles(list);
    return { profile: found };
  },
  /* admin enrols a teacher directly (e.g. name received by phone/WhatsApp) */
  addDirect: function (name, pin) {
    name = (name || '').trim();
    if (!name) return { error: 'Enter the teacher name.' };
    if (!validPin(pin)) return { error: 'Issue a PIN of at least 4 digits.' };
    var list = loadProfiles();
    var dup = list.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (dup) return { error: 'That name is already registered.' };
    var profile = { id: uid(), name: name, status: 'approved', pin: hashPin(pin),
                    created: new Date().toISOString().slice(0, 10) };
    list.push(profile);
    saveProfiles(list);
    return { profile: profile };
  },
  /* share the member list with another device (e.g. via WhatsApp) so teachers
     can log in there with their admin-issued PIN. Local admin PIN is never exported. */
  exportMembers: function () {
    var a = loadAdmin();
    return { type: 'scpb-members', admin: a ? { name: a.name, locked: !!a.locked } : null,
             profiles: loadProfiles() };
  },
  importMembers: function (data) {
    if (!data || data.type !== 'scpb-members' || !Array.isArray(data.profiles))
      return { error: 'Invalid members file.' };
    var list = loadProfiles();
    var added = 0, updated = 0;
    data.profiles.forEach(function (p) {
      if (!p || !p.id || !p.name) return;
      var f = null;
      list.forEach(function (x) { if (x.id === p.id) f = x; });
      if (f) {
        f.name = p.name;
        f.status = p.status === 'pending' ? 'pending' : 'approved';
        if (p.pin) f.pin = p.pin;
        updated++;
      } else {
        list.push({ id: p.id, name: p.name,
          status: p.status === 'pending' ? 'pending' : 'approved',
          pin: p.pin || '', created: p.created || '' });
        added++;
      }
    });
    saveProfiles(list);
    if (data.admin && typeof data.admin.locked === 'boolean') {
      var a = loadAdmin();
      if (a) { a.locked = data.admin.locked; saveAdmin(a); }
    }
    return { added: added, updated: updated };
  },
  resetPin: function (id, pin) {
    if (!validPin(pin)) return { error: 'New PIN must be at least 4 digits.' };
    var list = loadProfiles();
    var found = null;
    list.forEach(function (p) { if (p.id === id) found = p; });
    if (!found) return { error: 'Member not found.' };
    found.pin = hashPin(pin);
    saveProfiles(list);
    return { profile: found };
  },
  verifyMember: function (id, pin) {
    var p = findProfile(id);
    if (!p) return { error: 'Profile not found.' };
    if (p.status !== 'approved') return { error: 'Access not yet approved by the admin.' };
    if (!p.pin || p.pin !== hashPin(pin || '')) return { error: 'Wrong PIN. Use the PIN provided by the admin.' };
    if (this.isLocked()) return { error: 'System is locked by the admin. Try later.' };
    return { profile: p };
  },
  remove: function (id) {
    saveProfiles(loadProfiles().filter(function (p) { return p.id !== id; }));
    try {
      localStorage.removeItem('scpb-' + id + '-lib');
      localStorage.removeItem('scpb-' + id + '-repometa');
    } catch (e) {}
  },
  migrateLegacy: migrateLegacy,

  /* session: {role:'admin'} or {role:'teacher', id} */
  loginAdmin: function () {
    try { sessionStorage.setItem(SS_SESSION, JSON.stringify({ role: 'admin' })); } catch (e) {}
  },
  loginTeacher: function (id) {
    try { sessionStorage.setItem(SS_SESSION, JSON.stringify({ role: 'teacher', id: id })); } catch (e) {}
  },
  logout: function () {
    try { sessionStorage.removeItem(SS_SESSION); } catch (e) {}
  },
  current: function () {
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(SS_SESSION) || 'null'); } catch (e) { return null; }
    if (!s) {
      /* backwards-compatible plain-id sessions */
      var old = null;
      try { old = sessionStorage.getItem(SS_SESSION); } catch (e2) {}
      if (old && old.charAt(0) !== '{') {
        var p = findProfile(old);
        return p && p.status === 'approved' ? { role: 'teacher', id: p.id, name: p.name } : null;
      }
      return null;
    }
    if (s.role === 'admin') return { role: 'admin', id: 'admin', name: this.adminName() };
    var prof = findProfile(s.id);
    if (!prof || prof.status !== 'approved') return null;
    return { role: 'teacher', id: prof.id, name: prof.name };
  }
};
})();
