/* Scheme-Cum-Plan Builder — app logic (offline, no dependencies) */
(function () {
'use strict';

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function br(s) { return esc(s).replace(/\n/g, '<br>'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function debounce(fn, ms) {
  var t; return function () { clearTimeout(t); var a = arguments, s = this; t = setTimeout(function () { fn.apply(s, a); }, ms); };
}
function download(blob, name) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

var LS_LEGACY = 'scpb-v1';
var LS_LEGACY_REPO = 'scpb-repo-meta';

/* ---------- state (active scheme, profile-scoped) ---------- */
function blankOverview() {
  return { school: '', subject: '', grade: '', teacher: '', term: '1', year: '2026',
           objK: '', objS: '', objV: '', community: '' };
}
function blankRow() {
  return { id: uid(), lang: 'en', method: '', week: '', period: '', minutes: '', topic: '', cross: '',
    objK: '', objS: '', objV: '', indicators: '', assumed: '', competencies: [],
    refCode: '', resources: '', community: '', digital: '', textbooks: '',
    introMins: '', hook: '', ikLink: '', devMins: '',
    act1: '', act1t: '', act2: '', act2t: '', act3: '', act3t: '',
    conclMins: '', closure: '',
    obs: '', assessMethod: '', criteria: '', rRemarks: '',
    weekEnding: '' };
}
var state = { name: 'My Scheme-Cum-Plan', ov: blankOverview(), rows: [], repoMeta: [], uiLang: 'en', docLang: 'en', editMode: 'view' };
var lib = null;

function activeId() { return lib && lib.activeId; }
function save() {
  if (lib) {
    var s = null;
    lib.schemes.forEach(function (x) { if (x.id === lib.activeId) s = x; });
    if (s) {
      s.name = state.name; s.ov = state.ov; s.rows = state.rows;
      s.uiLang = state.uiLang; s.docLang = state.docLang;
      Store.touch(s);
      Store.saveLib(lib);
    }
    Store.saveRepoMeta(state.repoMeta);
  }
  var el = $('saveState');
  el.textContent = 'Saving...';
  clearTimeout(save._t);
  save._t = setTimeout(function () { el.textContent = 'Saved \u2713'; }, 400);
}
function adoptIntoState(s) {
  state.name = s.name || 'My Scheme-Cum-Plan';
  state.ov = Object.assign(blankOverview(), s.ov || {});
  state.rows = Array.isArray(s.rows) ? s.rows.map(function (r) { return Object.assign(blankRow(), r); }) : [];
  if (s.uiLang && STR.tab_overview[s.uiLang]) state.uiLang = s.uiLang;
  if (s.docLang && DOC.col_obj[s.docLang]) state.docLang = s.docLang;
}
function load() {
  lib = Store.loadLib();
  if (!Array.isArray(lib.syllabi)) lib.syllabi = [];
  /* adopt pre-login data saved by older versions */
  if (!lib.schemes.length) {
    var legacy = null, legacyRepo = [];
    try { legacy = JSON.parse(localStorage.getItem(LS_LEGACY) || 'null'); } catch (e) {}
    try {
      var lr = JSON.parse(localStorage.getItem(LS_LEGACY_REPO) || 'null');
      if (Array.isArray(lr)) legacyRepo = lr;
    } catch (e2) {}
    if (legacy && (legacy.rows || legacy.ov)) {
      var s0 = Store.blankScheme('My Scheme-Cum-Plan');
      s0.ov = legacy.ov || null; s0.rows = legacy.rows || [];
      lib = { schemes: [s0], activeId: s0.id };
      Store.saveLib(lib);
      state.repoMeta = legacyRepo;
      Store.saveRepoMeta(legacyRepo);
      try { localStorage.removeItem(LS_LEGACY); localStorage.removeItem(LS_LEGACY_REPO); } catch (e3) {}
    }
  }
  if (!lib.schemes.length) {
    var s1 = Store.blankScheme('My Scheme-Cum-Plan');
    lib = { schemes: [s1], activeId: s1.id };
    Store.saveLib(lib);
  }
  var cur = null;
  lib.schemes.forEach(function (x) { if (x.id === lib.activeId) cur = x; });
  if (!cur) { cur = lib.schemes[0]; lib.activeId = cur.id; Store.saveLib(lib); }
  adoptIntoState(cur);
  state.repoMeta = Store.repoMeta();
}

/* ---------- interface languages: en / sh (ChiShona) / nd (IsiNdebele) ---------- */
var STR = {
subtitle: { en: 'Integrated schemes of work + lesson plans \u2022 per Teacher Training Script (Scheme-Cum-Planning)',
  sh: 'Zvirongwa zvezvidzidzo zvakabatanidzwa \u2022 Gwaro reKudzidzisa Vadzidzisi',
  nd: 'Izinhlelo zezifundo ezihlanganisiweyo \u2022 Umbiko Wokuqeqesha Abafundisi' },
tab_overview: { en: '1. Term Overview', sh: '1. Mhedziso yeTemu', nd: '1. Isifinyezo sekota' },
tab_entries: { en: '2. Scheme Entries', sh: '2. Zvidzidzo', nd: '2. Izifundo' },
tab_preview: { en: '3. Table Preview', sh: '3. Tafura', nd: '3. Ithebula' },
tab_repo: { en: '4. Media Repository', sh: '4. Dura reMabhuku', nd: '4. Amabhuku' },
tab_guides: { en: '5. Guides', sh: '5. Nhungamiro', nd: '5. Isiqondiso' },
tab_backup: { en: '6. Export / Backup', sh: '6. Kuburitsa', nd: '6. Ukukhipha' },
h_overview: { en: 'Section A: Term Overview', sh: 'Chikamu A: Mhedziso yeTemu', nd: 'Isigaba A: Isifinyezo sekota' },
h_entries: { en: 'Scheme Entries (one card = one table row)', sh: 'Zvidzidzo (kadhi rimwe = mutsara mumwe)', nd: 'Izifundo (ikhadi elilodwa = umugca munye)' },
h_preview: { en: 'Scheme-Cum-Plan (Table Format)', sh: 'Chirongwa-che-Zvidzidzo (Tafura)', nd: 'Uhlelo-lwezifundo (Ithebula)' },
h_repo: { en: 'Media Repository \u2014 Syllabus & Textbooks', sh: 'Dura reMabhuku \u2014 Silabhasi neMabhuku', nd: 'Amabhuku \u2014 Isilabhasi leMabhuku' },
h_guides: { en: 'Planning Guides (from the Training Script)', sh: 'Nhungamiro (kubva muGwaro)', nd: 'Isiqondiso (kusuka eMbikweni)' },
h_backup: { en: 'Export / Backup', sh: 'Buritsa / Chengetedza', nd: 'Khipha / Gcina' },
btn_add: { en: '+ Add Week Entry', sh: '+ Wedzera Chidzidzo', nd: '+ Engeza Isifundo' },
btn_autocompile: { en: 'Auto-compile from topics', sh: 'Gadzira kubva paMisoro', nd: 'Hlanganisa ngezihloko' },
btn_example: { en: 'Load Worked Example', sh: 'Isa Muenzaniso', nd: 'Faka Isibonelo' },
btn_print: { en: 'Print / Save as PDF', sh: 'Pirinda / Sevha sePDF', nd: 'Phrinta / Gcina njengePDF' },
btn_word: { en: 'Download Word (.doc)', sh: 'Dhawunirodha Word (.doc)', nd: 'Thatha iWord (.doc)' },
btn_csv: { en: 'Download CSV', sh: 'Dhawunirodha CSV', nd: 'Thatha iCSV' },
btn_upload: { en: 'Upload', sh: 'Isa', nd: 'Faka' },
btn_exportjson: { en: 'Export JSON backup', sh: 'Buritsa kopi yeJSON', nd: 'Khipha ikhophi yeJSON' },
btn_clear: { en: 'Clear all data', sh: 'Dzima zvese', nd: 'Sula konke' },
modal_compile_title: { en: 'Auto-compile entries from syllabus topics', sh: 'Gadzira zvidzidzo kubva pamisoro yesilabhasi', nd: 'Hlanganisa izifundo ngezihloko zesilabhasi' },
btn_generate: { en: 'Generate drafts', sh: 'Gadzira', nd: 'Hlanganisa' },
btn_close: { en: 'Close', sh: 'Vhara', nd: 'Vala' },
repo_upload_h: { en: 'Upload documents', sh: 'Isa magwaro', nd: 'Faka amaphepha' },
lg_week: { en: 'Week / Period', sh: 'Vhiki / Nguva', nd: 'Iviki / Isikhathi' },
lg_weekEnding: { en: 'Week ending', sh: 'Kupedzisira kweVhiki', nd: 'Ukuphuka kweViki' },
lg_topic: { en: 'Topic / Content', sh: 'Musoro / Zvirimo', nd: 'Isihloko / Okuqukethweyo' },
lg_obj: { en: 'Objectives (Knowledge / Skills / Values / Indicators / Assumed knowledge)', sh: 'Zvinangwa (Ruzivo / Unyanzvi / Hunhu / Zviratidzo / Ruzivo rwavepo)', nd: 'Izinjongo (Ulwazi / Amakhono / Isimilo / Izinkomba / Ulwazi oluvele lukhona)' },
lg_comp: { en: 'Competences / Skills (from the syllabus)', sh: 'Hunyanzvi (kubva musilabhasi)', nd: 'Amakhono (avela kusilabhasi)' },
lg_ref: { en: 'References / Media', sh: 'Mareferensi', nd: 'Imithombo' },
entry_cross: { en: 'Cross-cutting themes (separate with ;)', sh: 'Misoro yakabatana (patswa ne ;)', nd: 'Izihloko ezixhumene (hlukanisa nge ;)' },
ph_cross: { en: 'e.g. Heritage studies; Environmental sustainability', sh: 'e.g. Zvidzidzo zvenhaka; Kuchengetedza nharaunda', nd: 'e.g. Izifundo zamagugu; Ukusimama kwemvelo' },
cmp_cross_label: { en: 'Cross-cutting theme', sh: 'Misoro yakabatana', nd: 'Izihloko ezixhumene' },
cmp_cross_auto: { en: 'Auto-detect from syllabus / topic', sh: 'Tsanangura kubva musilabhasi/musoro', nd: 'Thola ngokuzenzakalelayo kusilabhasi/isihloko' },
cmp_cross_none: { en: 'None', sh: 'Hakuna', nd: 'Akukho' },
th_ict: { en: 'ICT', sh: 'ICT', nd: 'I-ICT' },
th_gender: { en: 'Gender equality', sh: 'Kuenzana kwevanhukadzi nevanhurume', nd: 'Ukulingana ngobulili' },
th_hiv: { en: 'HIV and AIDS', sh: 'HIV neAIDS', nd: 'I-AIDS ne-HIV' },
th_rights: { en: 'Human rights', sh: 'Kodzero dzevanhu', nd: 'Amalungelo abantu' },
th_env: { en: 'Environmental sustainability', sh: 'Kuchengetedza nharaunda', nd: 'Ukusimama kwemvelo' },
th_disaster: { en: 'Disaster risk reduction', sh: 'Kuderedza njodzi', nd: 'Ukunciphisa ubungozi' },
th_finance: { en: 'Financial literacy', sh: 'Ruzivo rwezvemari', nd: 'Ulwazi lwezezimali' },
th_heritage: { en: 'Heritage studies', sh: 'Zvidzidzo zvenhaka', nd: 'Izifundo zamagugu' },
lg_meth: { en: 'Methods and Activities', sh: 'Nzira neMabasa', nd: 'Izindlela leMisebenzi' },
lg_eval: { en: 'Evaluation', sh: 'Ongororo', nd: 'Ukuhlola' },
entry_title: { en: 'Week Entry', sh: 'Chidzidzo', nd: 'Isifundo' },
btn_dup: { en: 'Duplicate', sh: 'Tevedzera', nd: 'Phinda' },
btn_del: { en: 'Delete', sh: 'Dzima', nd: 'Sula' },
btn_attach: { en: 'Attach from Repository', sh: 'Batanidza kubva muDura', nd: 'Namathisela usuka emabhukwini' },
grid_topic: { en: 'Topic', sh: 'Musoro', nd: 'Isihloko' },
grid_code: { en: 'Syllabus code', sh: 'Kodhi yesilabhasi', nd: 'Ikhodi yesilabhasi' },
grid_subtopic: { en: 'Sub-topics', sh: 'Zvinosanganisira', nd: 'Izihloko zaphasi' },
grid_type: { en: 'Type', sh: 'Mutauro', nd: 'Uhlobo' },
grid_lessons: { en: 'Lessons', sh: 'Zvidzidzo', nd: 'Izifundo' },
grid_pages: { en: 'Syllabus pages', sh: 'Mapeji esilabhasi', nd: 'Amapheji esilabhasi' },
grid_textbooks: { en: 'Textbooks (one per line)', sh: 'Mabhuku (imwe paimwe)', nd: 'Amabhuku (ililodwa ngalilodwa)' },
repo_stored_h: { en: 'Stored documents', sh: 'Magwaro akachengetwa', nd: 'Amaphepha agciniweyo' },
backup_docs_h: { en: 'Documents', sh: 'Magwaro', nd: 'Amaphepha' },
backup_data_h: { en: 'Data backup', sh: 'Kuchengetedza data', nd: 'Ukugcina idatha' }
};
function T(k) {
  var L = state.uiLang || 'en';
  if (STR[k] && STR[k][L]) return STR[k][L];
  return STR[k] ? STR[k].en : k;
}
function applyLang() {
  var L = state.uiLang || 'en';
  if (!STR.tab_overview[L]) L = 'en';
  Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
    var k = el.getAttribute('data-i18n');
    if (STR[k] && STR[k][L]) el.textContent = STR[k][L];
  });
  var sel = $('uiLang');
  if (sel) sel.value = state.uiLang || 'en';
}

/* ---------- document language: table headers + structural labels ---------- */
var DOC = {
doc_title: { en: 'SCHEME-CUM-PLAN', sh: 'CHIRONGWA-CHE-ZVIDZIDZO', nd: 'UHLELO LWEZIFUNDO' },
school: { en: 'School:', sh: 'Chikoro:', nd: 'Isikolo:' },
subject: { en: 'Subject:', sh: 'Chidzidzo:', nd: 'Isifundo:' },
grade: { en: 'Grade/Form:', sh: 'Giredhi/Fomu:', nd: 'Ibanga/Iformu:' },
teacher: { en: 'Teacher:', sh: 'Mudzidzisi:', nd: 'Umfundisi:' },
term: { en: 'Term:', sh: 'Temu:', nd: 'Ikota:' },
year: { en: 'Year:', sh: 'Gore:', nd: 'Unyaka:' },
termObj: { en: 'TERM OBJECTIVES:', sh: 'ZVINANGWA ZVETEMU:', nd: 'IZINJONGO ZEKOTA:' },
knowledge: { en: 'Knowledge', sh: 'Ruzivo', nd: 'Ulwazi' },
skills: { en: 'Skills', sh: 'Unyanzvi', nd: 'Amakhono' },
values: { en: 'Values', sh: 'Hunhu', nd: 'Isimilo' },
community: { en: 'COMMUNITY RESOURCES PLANNED:', sh: 'RUBATSIRO RWEMUNHARAUNDA:', nd: 'USIZO LOMPHAKATHI:' },
col_week: { en: 'Week / Period', sh: 'Vhiki / Nguva', nd: 'Iviki / Isikhathi' },
col_topic: { en: 'Topic / Content', sh: 'Musoro / Zvirimo', nd: 'Isihloko / Okuqukethweyo' },
col_obj: { en: 'Objectives', sh: 'Zvinangwa', nd: 'Izinjongo' },
col_comp: { en: 'Competences / Skills', sh: 'Hunyanzvi', nd: 'Amakhono' },
col_ref: { en: 'References / Media', sh: 'Mareferensi', nd: 'Imithombo' },
col_meth: { en: 'Methods and Activities', sh: 'Nzira neMabasa', nd: 'Izindlela leMisebenzi' },
col_eval: { en: 'Evaluation', sh: 'Ongororo', nd: 'Ukuhlola' },
period: { en: 'Period', sh: 'Nguva', nd: 'Isikhathi' },
minutes: { en: 'minutes', sh: 'maminitsi', nd: 'amaminithi' },
min: { en: 'min', sh: 'mamin', nd: 'imin' },
weekEnding: { en: 'Week ending', sh: 'Kupedzisira kweVhiki', nd: 'Ukuphuka kweViki' },
cross: { en: 'Cross-cutting:', sh: 'Misoro yakabatana:', nd: 'Izihloko ezixhumene:' },
indicators: { en: 'Indicators', sh: 'Zviratidzo', nd: 'Izinkomba' },
assumed: { en: 'Assumed knowledge', sh: 'Ruzivo rwavepo', nd: 'Ulwazi oluvele lukhona' },
syllabus: { en: 'Syllabus', sh: 'Silabhasi', nd: 'Isilabhasi' },
resources: { en: 'Resources', sh: 'Zvishandiso', nd: 'Izisetshenziswa' },
expert: { en: 'Community expert/video', sh: 'Nyanzvi yemunharaunda/vhidhiyo', nd: 'Uchwepheshe womphakathi/ividiyo' },
digital: { en: 'Digital', sh: 'Zvedhijitari', nd: 'OkweDijithali' },
textbooks: { en: 'Textbooks', sh: 'Mabhuku', nd: 'Amabhuku' },
intro: { en: 'INTRODUCTION', sh: 'KUTANGA', nd: 'UKUQALA' },
dev: { en: 'DEVELOPMENT', sh: 'MUKATI', nd: 'PHAKATHI' },
concl: { en: 'CONCLUSION', sh: 'KUPEDZISA', nd: 'UKUPHETHA' },
obs: { en: 'Observation', sh: 'Kucherechedza', nd: 'Ukuqaphela' },
assess: { en: 'Assessment method', sh: 'Nzira yekuongorora', nd: 'Indlela yokuhlola' },
criteria: { en: 'Criteria', sh: 'Miyero', nd: 'Imigomo' },
reflection: { en: 'POST-LESSON REFLECTION:', sh: 'KUFUNGISISA PASHURE PECHIDZIDZO:', nd: 'UKUZIHLAZIYA NGEMVA KWESIFUNDO:' },
r_worked: { en: 'What worked \u2013 ', sh: 'Zvashanda \u2013 ', nd: 'Okuhambe kahle \u2013 ' },
r_timing: { en: 'Timing: ', sh: 'Nguva: ', nd: 'Isikhathi: ' },
r_resources: { en: 'Resources: ', sh: 'Zvishandiso: ', nd: 'Izisetshenziswa: ' },
r_modify: { en: 'Modify: ', sh: 'Zvekuchinja: ', nd: 'Okutshintsha: ' },
r_follow: { en: 'Follow-up: ', sh: 'Kutevera: ', nd: 'Ukulandelela: ' },
remarks: { en: 'Teacher\u2019s evaluation remarks', sh: 'Mashoko emudzidzisi pakuongorora', nd: 'Amazwi omfundisi ngokuhlola' },
remarks_write: { en: 'Teacher\u2019s evaluation remarks (write after the lesson):', sh: 'Mashoko emudzidzisi pakuongorora (nyora pashure pechidzidzo):', nd: 'Amazwi omfundisi ngokuhlola (bhala ngemva kwesifundo):' },
sign_teacher: { en: 'Teacher:', sh: 'Mudzidzisi:', nd: 'Umfundisi:' },
sign_hod: { en: 'HOD:', sh: 'Mukuru wechikamu:', nd: 'Inhloko yomnyango:' },
sign_head: { en: 'Head:', sh: 'Mukuru wechikoro:', nd: 'Inhloko yesikolo:' },
sign_date: { en: 'Date:', sh: 'Zuva:', nd: 'Usuku:' }
};
function D(k) {
  var L = (typeof state !== 'undefined' && state.docLang) || 'en';
  if (!DOC[k] || !DOC[k][L]) L = 'en';
  return DOC[k][L];
}

/* ---------- tabs ---------- */
var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab'));
var TAB_NAMES = ['overview', 'entries', 'preview', 'repo', 'guides', 'backup'];
function activateTab(name) {
  if (TAB_NAMES.indexOf(name) === -1) return;
  tabBtns.forEach(function (x) { x.classList.remove('active'); });
  tabBtns.forEach(function (x) { if (x.getAttribute('data-tab') === name) x.classList.add('active'); });
  Array.prototype.forEach.call(document.querySelectorAll('.tabpage'), function (p) { p.classList.remove('active'); });
  var page = $('tab-' + name);
  if (page) page.classList.add('active');
  if (name === 'preview') renderPreview();
  if (name === 'repo') renderRepo();
}
tabBtns.forEach(function (b) {
  b.addEventListener('click', function () { activateTab(b.getAttribute('data-tab')); });
});

/* ---------- overview ---------- */
var OV_IDS = ['ovSchool', 'ovSubject', 'ovGrade', 'ovTeacher', 'ovTerm', 'ovYear',
              'ovObjK', 'ovObjS', 'ovObjV', 'ovCommunity'];
var OV_KEYS = ['school', 'subject', 'grade', 'teacher', 'term', 'year',
               'objK', 'objS', 'objV', 'community'];
function syncOverviewToInputs() {
  OV_IDS.forEach(function (id, i) { $(id).value = state.ov[OV_KEYS[i]] || ''; });
}
OV_IDS.forEach(function (id, i) {
  $(id).addEventListener('input', function () {
    state.ov[OV_KEYS[i]] = $(id).value; save(); previewSoon();
  });
});

/* ---------- entries ---------- */
var COMP_SUGGEST = ['Critical thinking', 'Problem-solving', 'Practical skills',
  'Cultural competence', 'Communication', 'Collaboration', 'Creativity', 'Digital literacy'];
var THEME_SUGGEST = ['ICT', 'Gender equality', 'HIV and AIDS', 'Human rights',
  'Environmental sustainability', 'Disaster risk reduction', 'Financial literacy', 'Heritage studies'];

function field(label, rowId, name, val, ph, rows, ro) {
  var att = ro ? ' readonly' : '';
  var input = rows
    ? '<textarea data-field="' + name + '" rows="' + rows + '" placeholder="' + esc(ph || '') + '"' + att + '>' + esc(val) + '</textarea>'
    : '<input type="text" data-field="' + name + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '"' + att + '>';
  return '<label>' + label + input + '</label>';
}

function entryCard(r, idx) {
  var isView = state.editMode === 'view';
  var isEdit = state.editMode === 'edit';
  var isDelete = state.editMode === 'delete';
  var disabled = isEdit ? '' : ' disabled';
  var readonly = isEdit ? '' : ' readonly';
  var delBtnStyle = isDelete ? ' style="background:#c00;color:#fff;"' : '';
  
  var comps = COMP_SUGGEST.map(function (c) {
    var on = r.competencies.indexOf(c) !== -1;
    return '<button type="button" class="chip' + (on ? ' active' : '') + '" data-comp="' + esc(c) + '"' + disabled + '>' + esc(translateComp(c, state.uiLang)) + '</button>';
  }).join('');
  var themes = THEME_SUGGEST.map(function (t) {
    return '<button type="button" class="chip" data-theme="' + esc(t) + '"' + disabled + '>+ ' + esc(translateTheme(t, state.uiLang)) + '</button>';
  }).join('');
  var customComps = r.competencies.filter(function (c) { return COMP_SUGGEST.indexOf(c) === -1; }).join(', ');

  return '' +
  '<div class="card entry" data-row="' + r.id + '">' +
    '<div class="entry-head"><strong>' + esc(T('entry_title')) + ' ' + (idx + 1) + '</strong>' +
      '<span class="row-btns">' +
        '<button type="button" data-lang="en" title="English content"' + ((r.lang || 'en') === 'en' ? ' class="on"' : '') + disabled + '>EN</button>' +
        '<button type="button" data-lang="sh" title="ChiShona content"' + (r.lang === 'sh' ? ' class="on"' : '') + disabled + '>SH</button>' +
        '<button type="button" data-lang="nd" title="IsiNdebele content"' + (r.lang === 'nd' ? ' class="on"' : '') + disabled + '>ND</button>' +
        '<button type="button" data-act="up" title="Move up"' + disabled + '>\u25B2</button>' +
        '<button type="button" data-act="down" title="Move down"' + disabled + '>\u25BC</button>' +
        '<button type="button" data-act="dup" title="Duplicate"' + disabled + '>' + esc(T('btn_dup')) + '</button>' +
        '<button type="button" data-act="del" title="Delete"' + delBtnStyle + (isDelete ? '' : ' disabled') + '>' + esc(T('btn_del')) + '</button>' +
      '</span></div>' +

    '<fieldset><legend>' + esc(T('lg_week')) + '</legend><div class="inline-4">' +
      field('Week', r.id, 'week', r.week, 'e.g. Week 3', '', readonly) +
      field('Period', r.id, 'period', r.period, 'e.g. 1', '', readonly) +
      field('Minutes', r.id, 'minutes', r.minutes, 'e.g. 35', '', readonly) +
      field(T('lg_weekEnding'), r.id, 'weekEnding', r.weekEnding, 'e.g. 2026-01-23', '', readonly) +
    '</div></fieldset>' +

    '<fieldset><legend>' + esc(T('lg_topic')) + '</legend>' +
      field('Topic name', r.id, 'topic', r.topic, 'e.g. Temperature and Fermentation', '', readonly) +
      field(T('entry_cross'), r.id, 'cross', r.cross, T('ph_cross'), '', readonly) +
      '<div class="comp-chips">' + themes + '</div>' +
    '</fieldset>' +

    '<fieldset><legend>' + esc(T('lg_obj')) + '</legend>' +
      '<p class="hint" style="margin-top:0">By the end of the lesson, learners should be able to:</p>' +
      field('Knowledge \u2014 what learners will know', r.id, 'objK', r.objK, '', 2, readonly) +
      field('Skills \u2014 what learners will do', r.id, 'objS', r.objS, '', 2, readonly) +
      field('Values \u2014 dispositions to develop', r.id, 'objV', r.objV, '', 2, readonly) +
      field('Indicators \u2014 observable evidence with targets', r.id, 'indicators', r.indicators, 'e.g. 7/10 learners will...', 2, readonly) +
      field('Assumed knowledge \u2014 what learners already know', r.id, 'assumed', r.assumed, '', 2, readonly) +
    '</fieldset>' +

    '<fieldset><legend>' + esc(T('lg_comp')) + '</legend>' +
      '<div class="comp-chips">' + comps + '</div>' +
      field('Other competences (comma separated)', r.id, 'customComps', customComps, 'e.g. Map reading', '', readonly) +
    '</fieldset>' +

    '<fieldset><legend>' + esc(T('lg_ref')) + '</legend>' +
      field('Syllabus code', r.id, 'refCode', r.refCode, 'e.g. 5.2.4', '', readonly) +
      field('Resources \u2014 list materials', r.id, 'resources', r.resources, 'e.g. Sugar, yeast, water, balloons, 3 bottles', 2, readonly) +
      field('Community expert / video', r.id, 'community', r.community, 'e.g. Video: Sekuru Chiweshe brewing', 2, readonly) +
      field('Digital resources (if any)', r.id, 'digital', r.digital, '', 2, readonly) +
      field('Textbooks with page references', r.id, 'textbooks', r.textbooks, 'e.g. New Combined Science Form 2, pp. 41\u201343', 2, readonly) +
      '<button type="button" class="btn small" data-act="attach"' + disabled + '>' + esc(T('btn_attach')) + '</button>' +

    '</fieldset>' +

    '<fieldset><legend>' + esc(T('lg_meth')) + '</legend>' +
      '<div class="inline-3">' +
        field('Introduction (mins)', r.id, 'introMins', r.introMins, 'e.g. 5', '', readonly) +
        field('Development (mins)', r.id, 'devMins', r.devMins, 'e.g. 25', '', readonly) +
        field('Conclusion (mins)', r.id, 'conclMins', r.conclMins, 'e.g. 5', '', readonly) +
      '</div>' +
      field('Hook / question', r.id, 'hook', r.hook, '', 2, readonly) +
      field('Link to indigenous knowledge', r.id, 'ikLink', r.ikLink, '', 2, readonly) +
      '<div class="inline-2">' +
        field('Activity 1 description', r.id, 'act1', r.act1, '', 2, readonly) +
        field('Activity 1 time', r.id, 'act1t', r.act1t, 'e.g. 5 min', '', readonly) +
      '</div><div class="inline-2">' +
        field('Activity 2 description', r.id, 'act2', r.act2, '', 2, readonly) +
        field('Activity 2 time', r.id, 'act2t', r.act2t, 'e.g. 8 min', '', readonly) +
      '</div><div class="inline-2">' +
        field('Activity 3 description', r.id, 'act3', r.act3, '', 2, readonly) +
        field('Activity 3 time', r.id, 'act3t', r.act3t, 'e.g. 12 min', '', readonly) +
      '</div>' +
      field('Conclusion \u2014 closure activity / exit card', r.id, 'closure', r.closure, 'e.g. Exit card: Why does warmth help?', 2, readonly) +
    '</fieldset>' +

    '<fieldset><legend>' + esc(T('lg_eval')) + '</legend>' +
      field('Observation', r.id, 'obs', r.obs, '', 3, readonly) +
      field('Assessment', r.id, 'assessMethod', r.assessMethod, '', 3, readonly) +
      field('Criteria', r.id, 'criteria', r.criteria, '', 3, readonly) +
      field('Teacher\u2019s evaluation remarks', r.id, 'rRemarks', r.rRemarks, '', 3, readonly) +
    '</fieldset>' +
  '</div>';
}

function renderEntries() {
  if (!state.rows.length) {
    $('entriesList').innerHTML = '<p class="hint">No entries yet. Click \u201C+ Add Week Entry\u201D to begin, or load the worked example.</p>';
    return;
  }
  $('entriesList').innerHTML = state.rows.map(entryCard).join('');
}
function findRow(id) {
  for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return { r: state.rows[i], i: i };
  return null;
}

$('entriesList').addEventListener('input', function (e) {
  var t = e.target;
  var card = t.closest ? t.closest('[data-row]') : null;
  if (!card || !t.getAttribute('data-field')) return;
  var hit = findRow(card.getAttribute('data-row'));
  if (!hit) return;
  var f = t.getAttribute('data-field');
  if (f === 'customComps') {
    var customs = t.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var kept = hit.r.competencies.filter(function (c) { return COMP_SUGGEST.indexOf(c) !== -1; });
    hit.r.competencies = kept.concat(customs.filter(function (c) { return kept.indexOf(c) === -1; }));
  } else {
    hit.r[f] = t.value;
  }
  save(); previewSoon();
});

$('entriesList').addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('button') : null;
  if (!btn) return;
  var card = btn.closest('[data-row]');
  if (!card) return;
  var hit = findRow(card.getAttribute('data-row'));
  if (!hit) return;
  var r = hit.r, i = hit.i;
  if (btn.hasAttribute('data-lang')) {
    var L = btn.getAttribute('data-lang') || 'en';
    if ((r.lang || 'en') === L) return;
    var lname = L === 'sh' ? 'ChiShona' : (L === 'nd' ? 'IsiNdebele' : 'English');
    if (!confirm('Re-draft this entry\u2019s generated content in ' + lname + '? Your notes, remarks, resources and times are kept.')) return;
    regenerateRow(r, L);
    save(); renderEntries(); renderPreview(); return;
  }
  if (btn.hasAttribute('data-comp')) {
    var c = btn.getAttribute('data-comp');
    var ix = r.competencies.indexOf(c);
    if (ix === -1) r.competencies.push(c); else r.competencies.splice(ix, 1);
    btn.classList.toggle('active');
    save(); previewSoon(); return;
  }
  if (btn.hasAttribute('data-theme')) {
    var th = btn.getAttribute('data-theme');
    var cur = (r.cross || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    if (cur.indexOf(th) === -1) cur.push(th);
    r.cross = cur.join('; ');
    var inp = card.querySelector('[data-field="cross"]');
    if (inp) inp.value = r.cross;
    save(); previewSoon(); return;
  }
  var act = btn.getAttribute('data-act');
  if (act === 'del') {
    if (confirm('Delete this entry?')) { state.rows.splice(i, 1); save(); renderEntries(); renderPreview(); }
  } else if (act === 'dup') {
    var copy = JSON.parse(JSON.stringify(r)); copy.id = uid();
    state.rows.splice(i + 1, 0, copy); save(); renderEntries(); renderPreview();
  } else if (act === 'up' && i > 0) {
    state.rows[i] = state.rows[i - 1]; state.rows[i - 1] = r;
    save(); renderEntries(); renderPreview();
  } else if (act === 'down' && i < state.rows.length - 1) {
    state.rows[i] = state.rows[i + 1]; state.rows[i + 1] = r;
    save(); renderEntries(); renderPreview();
  } else if (act === 'attach') {
    openAttachModal(r.id);
  }
});

$('btnAddEntry').addEventListener('click', function () {
  state.rows.push(blankRow()); save(); renderEntries(); renderPreview();
  var cards = document.querySelectorAll('#entriesList .entry');
  if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('btnBulkLang').addEventListener('click', function () {
  if (!state.rows.length) return;
  var L = $('bulkLang').value || 'en';
  if (!GEN[L]) L = 'en';
  var lname = L === 'sh' ? 'ChiShona' : (L === 'nd' ? 'IsiNdebele' : 'English');
  if (!confirm('Re-draft ALL ' + state.rows.length + ' entries in ' + lname + '? Notes, remarks, resources and times are kept.')) return;
  state.rows.forEach(function (r) { regenerateRow(r, L); });
  save(); renderEntries(); renderPreview();
});

/* ---------- worked example (Training Script, p.8) ---------- */
function workedExampleFull() {
  var ov = { school: 'Harare Secondary School', subject: 'Combined Science', grade: '2',
    teacher: 'Mr. T. Moyo', term: '1', year: '2025',
    objK: 'Understand fermentation processes', objS: 'Conduct controlled experiments',
    objV: 'Appreciate indigenous knowledge systems',
    community: 'Sekuru Chiweshe (traditional brewer)' };
  var r = blankRow();
  Object.assign(r, {
    week: 'Week 3', period: '1', minutes: '35',
    topic: 'Temperature and Fermentation', cross: 'Heritage studies',
    objK: 'Explain why warmth speeds fermentation',
    objS: 'Set up temperature experiment',
    objV: 'Appreciate science in traditional brewing',
    indicators: '7/10 learners link warmth to faster fermentation', assumed: '',
    competencies: ['Critical thinking', 'Practical skills', 'Cultural competence'],
    refCode: '5.2.4', resources: 'Sugar, yeast, water, balloons, 3 bottles',
    community: 'Video: Sekuru Chiweshe brewing', digital: '', textbooks: '',
    introMins: '5', hook: 'Show video: Sekuru keeps brewing pot warm',
    ikLink: 'Ask: "Why near the fire?"', devMins: '25',
    act1: 'Watch: Sekuru explains warmth speeds process', act1t: '5 min',
    act2: 'Teach: Temperature increases enzyme activity', act2t: '8 min',
    act3: 'Groups set up 3 bottles: cold, room temp, warm', act3t: '12 min',
    conclMins: '5', closure: 'Exit card: Why does warmth help?',
    obs: 'Can learners explain temperature effect?',
    assessMethod: 'Exit Card: Link warmth to fermentation speed',
    criteria: 'Learner explains why warmth helps fermentation',
    rAchieve: '8/10 achieved objective.',
    rWorked: 'Video hook excellent but trim to 1.5 min.',
    rTiming: 'Groups finished early \u2013 added predictions (formalise next term).',
    rResources: 'Pre-measure ingredients next time. Need 4th thermometer.',
    rModify: '', rFollow: 'Follow up with 2 struggling learners.'
  });
  return { ov: ov, row: r };
}
$('btnLoadExample').addEventListener('click', function () {
  var ex = workedExampleFull();
  state.ov = ex.ov; state.rows.push(ex.row);
  syncOverviewToInputs(); save(); renderEntries(); renderPreview();
  alert('Worked example loaded (Combined Science, Form 2, Week 3).');
});

/* ---------- auto-compile drafts from topics ---------- */
/* generator language packs: en = English, sh = ChiShona, nd = IsiNdebele */
var GEN = {
en: {
  stem: 'By the end of the lesson, learners should be able to:',
  lessonWord: 'Lesson', ofWord: 'of', weekWord: 'Week', minWord: 'min',
  objK: 'Explain key concepts of {T}',
  objS: 'Demonstrate {T} through guided practice and group tasks',
  objV: 'Appreciate the importance of {T} in everyday life and indigenous practices',
  indicators: '7/10 learners will correctly explain {T} and complete the set tasks',
  assumed: 'Learners recall earlier work linked to {T}',
  hook: 'Display a puzzling picture or object related to {T}; ask: "What do you notice?"',
  ikLink: 'Elicit a local or indigenous example, practice or proverb connected with {T}',
  closure: 'Exit card: each learner writes one key point learned about {T}',
  obs: 'Can learners explain {T} and apply it in the tasks?',
  assessMethod: 'Exit card and class exercise on {T}: learners show what they learned',
  criteria: 'Learner accurately explains {T} and completes tasks correctly',
  methods: {
  'Inquiry-Based': [
    'Pose a focus question on {T}; learners observe and record initial ideas',
    'Groups investigate {T} using textbooks, repository sources and discussion',
    'Groups present findings on {T}; class compares, questions and consolidates'],
  'Experiential / Hands-on': [
    'Demonstrate {T} while learners observe and note the key steps',
    'Groups practise {T} hands-on with available materials; teacher coaches',
    'Groups display their {T} outcomes; class discusses what worked'],
  'Collaborative Learning': [
    'Organise dare/nhimbe-style groups; assign {T} sub-tasks and roles',
    'Groups co-operate on {T} tasks, practising Ubuntu/Unhu/Vumunhu',
    'Groups report back on {T}; peers assess each contribution'],
  'Project-Based Learning': [
    'Present the {T} project task and success criteria; groups plan roles',
    'Groups research and produce their {T} artefact, linking school content with heritage/traditional knowledge',
    'Groups showcase {T} products; class assesses against the criteria'],
  'Storytelling': [
    'Elder/teacher narrates a story embodying {T}; learners listen for key ideas',
    'Learners retell and analyse the {T} story for its embedded knowledge',
    'Learners compose and share short {T} narratives with a moral'],
  'Community-Based': [
    'Brief learners on the {T} community observation/interview task',
    'Learners observe {T} in the community, interview knowledge holders and record',
    'Class collates {T} findings and links them to syllabus concepts']
  }
},
sh: {
  stem: 'Pakupera kwechidzidzo, vadzidzi vanofanira kukwanisa:',
  lessonWord: 'Chidzidzo', ofWord: 'che', weekWord: 'Vhiki', minWord: 'mamin',
  objK: 'Tsanangura pfungwa huru dze{T}',
  objS: 'Ratidza {T} nemabasa anotungamirwa neeboka',
  objV: 'Koshesa kukosha kwe{T} muhupenyu nemagariro',
  indicators: 'Vadzidzi 7/10 vachatsanangura {T} nemazvo vapedza mabasa',
  assumed: 'Vadzidzi vanorangarira zvidzidzo zvakapfuura zvine chekuita ne{T}',
  hook: 'Ratidza mufananidzo kana chinhu chinoshamisa chine chekuita ne{T}; bvunza: "Chii chamunoona?"',
  ikLink: 'Bvunzai muenzaniso wemuno, tsika kana tsumo ine chekuita ne{T}',
  closure: 'Kadhi rekubuda: mudzidzi mumwe nomumwe anonyora chinhu chimwe chaadzidza nezve{T}',
  obs: 'Vadzidzi vanogona kutsanangura {T} nekuishandisa mumabasa here?',
  assessMethod: 'Kadhi rekubuda nebasa remukirasi rezve{T}: vadzidzi vanoratidza zvavakadzidza',
  criteria: 'Mudzidzi anotsanangura {T} nemazvo apedza mabasa nemazvo',
  methods: {
  'Inquiry-Based': [
    'Bvunzai mubvunzo wakanangana ne{T}; vadzidzi vacherechedza vanyora',
    'Mapoka anoongorora {T} achishandisa mabhuku nokukurukurana',
    'Mapoka anopa zvakawanikwa pa{T}; kirasi inoenzanisa yobvumirana'],
  'Experiential / Hands-on': [
    'Ratidzai {T} vadzidzi vacherechedza matanho makuru',
    'Mapoka anoita {T} nemaoko nezvishandiso; mudzidzisi anotungamira',
    'Mapoka anoratidza zvakabuda pa{T}; kirasi inokurukura zvashanda'],
  'Collaborative Learning': [
    'Gadzirai mapoka sedare/nhimbe; govanai mabasa e{T}',
    'Mapoka anobatirana pa{T} achiita Ubuntu/Unhu/Vumunhu',
    'Mapoka anodzoka ne{T}; vezera vanoongorora mipiro'],
  'Project-Based Learning': [
    'Paisai basa reprojekti re{T} nemiyero; mapoka anoronga mabasa',
    'Mapoka anotumbura {T} achibatanidza chikoro nenhaka',
    'Mapoka anoratidza {T}; kirasi inoongorora ichitevera miyero'],
  'Storytelling': [
    'Mukuru anorondedzera ngano ine {T}; vadzidzi vanoteerera pfungwa huru',
    'Vadzidzi vanodudzira ngano ye{T} vachitsvaga zivo irimo',
    'Vadzidzi vanonyora vachipa ngano pfupi dze{T}'],
  'Community-Based': [
    'Tsanangurirai basa rekucherechedza {T} munharaunda',
    'Vadzidzi vanocherechedza {T} munharaunda, vabvunza vachengeti vezivo vanyora',
    'Kirasi inounganidza zvakawanikwa pa{T} yozvibatanidza nechidzidzo']
  }
},
nd: {
  stem: 'Ekupheleni kwesifundo, abafundi kumele bakwazi uku:',
  lessonWord: 'Isifundo', ofWord: 'kwe', weekWord: 'Iviki', minWord: 'imin',
  objK: 'Chaza imiqondo eqakathekileyo ye{T}',
  objS: 'Khombisa {T} ngemisebenzi eqondisiweyo leyamaqembu',
  objV: 'Azisa ukubaluleka kwe{T} empilweni lasemasikweni',
  indicators: 'Abafundi aba-7 kwaba-10 bazachaza {T} ngendlela beqede imisebenzi',
  assumed: 'Abafundi bayakhumbula imfundiso edluleyo ephathelene le{T}',
  hook: 'Khombisa umfanekiso kumbe into exakayo ephathelene le{T}; buza: "Libonani?"',
  ikLink: 'Celani isibonelo sasendaweni, isiko kumbe isaga esiphathelene le{T}',
  closure: 'Ikhadi lokuphuma: umfundi ngamunye ubhala into eyodwa ayifunde nge{T}',
  obs: 'Abafundi bayakwazi ukuchaza {T} bayisebenzise emisebenzini na?',
  assessMethod: 'Ikhadi lokuphuma lomsebenzi wekilasi nge{T}: abafundi bakhombisa abakufundileyo',
  criteria: 'Umfundi uchaza {T} ngendlela eqondileyo aqede imisebenzi ngendlela',
  methods: {
  'Inquiry-Based': [
    'Buzani umbuzo oqondene le{T}; abafundi baqaphele babhale',
    'Amaqembu aphenya nge{T} esebenzisa amabhuku exoxisana',
    'Amaqembu ethula okutholakeleyo nge{T}; ikilasi iqhathanisa ivumelane'],
  'Experiential / Hands-on': [
    'Khombisani i{T} abafundi beqaphela izinyathelo eziqakathekileyo',
    'Amaqembu enza i{T} ngezandla ngezisetshenziswa; umfundisi uqondisa',
    'Amaqembu akhombisa okuvelayo nge{T}; ikilasi lidingida okuhambe kahle'],
  'Collaborative Learning': [
    'Hlelani amaqembu njengedale; abelani imisebenzi ye{T}',
    'Amaqembu asebenzisana ku{T} esenza Ubuntu/Unhu/Vumunhu',
    'Amaqembu abuya nge{T}; ontanga bahlola iminikelo'],
  'Project-Based Learning': [
    'Bethulani umsebenzi weprojekthi ye{T} lemigomo; amaqembu ahlela imisebenzi',
    'Amaqembu enza i{T} ehlanganisa isikolo lamagugu',
    'Amaqembu akhombisa i{T}; ikilasi lihlola lilandelela imigomo'],
  'Storytelling': [
    'Ixhegu lilandisa ingano equkethe i{T}; abafundi balalele imiqondo eqakathekileyo',
    'Abafundi baphinda bahlaziye ingano ye{T} befuna ulwazi oluqukethweyo',
    'Abafundi babhala babelane ngezingano ezimfitshane ze{T}'],
  'Community-Based': [
    'Chazani umsebenzi wokuqaphela i{T} emphakathini',
    'Abafundi baqaphela i{T} emphakathini, babuza abagcini bolwazi babhale',
    'Ikilasi liqoqa okutholakeleyo nge{T} likuhlanganise lesifundo']
  }
}
};
var METHOD_COMP = {
  'Inquiry-Based': 'Communication', 'Experiential / Hands-on': 'Practical skills',
  'Collaborative Learning': 'Collaboration', 'Project-Based Learning': 'Creativity',
  'Storytelling': 'Cultural competence', 'Community-Based': 'Cultural competence'
};
/* ---------- translation dictionaries ---------- */
var THEME_DICT = {
  'ICT': { en: 'ICT', sh: 'ICT', nd: 'I-ICT' },
  'Environmental sustainability': { en: 'Environmental sustainability', sh: 'Kuchengetedza nharaunda', nd: 'Ukusimama kwemvelo' },
  'HIV and AIDS': { en: 'HIV and AIDS', sh: 'HIV neAIDS', nd: 'I-AIDS ne-HIV' },
  'Gender equality': { en: 'Gender equality', sh: 'Kuenzana kwevanhukadzi nevanhurume', nd: 'Ukulingana ngobulili' },
  'Human rights': { en: 'Human rights', sh: 'Kodzero dzevanhu', nd: 'Amalungelo abantu' },
  'Disaster risk reduction': { en: 'Disaster risk reduction', sh: 'Kuderedza njodzi', nd: 'Ukunciphisa ubungozi' },
  'Financial literacy': { en: 'Financial literacy', sh: 'Ruzivo rwezvemari', nd: 'Ulwazi lwezezimali' },
  'Heritage studies': { en: 'Heritage studies', sh: 'Zvidzidzo zvenhaka', nd: 'Izifundo zamagugu' }
};
var COMP_DICT = {
  'Critical thinking': { en: 'Critical thinking', sh: 'Kufunga kwakadzama', nd: 'Ukucabanga okujulile' },
  'Problem-solving': { en: 'Problem-solving', sh: 'Kugadzirisa matambudziko', nd: 'Ukuxazulula izinkinga' },
  'Practical skills': { en: 'Practical skills', sh: 'Unyanzvi hwekuita', nd: 'Amakhono okwenza' },
  'Cultural competence': { en: 'Cultural competence', sh: 'Ruzivo rwetsika nemagariro', nd: 'Ukhono lwamasiko' },
  'Communication': { en: 'Communication', sh: 'Kukurukurirana', nd: 'Ukuxhumana' },
  'Collaboration': { en: 'Collaboration', sh: 'Kushandira pamwe', nd: 'Ukusebenzisana' },
  'Creativity': { en: 'Creativity', sh: 'Kugadzira zvitsva', nd: 'Ubuciko bokudala' },
  'Digital literacy': { en: 'Digital literacy', sh: 'Ruzivo rwedhijitari', nd: 'Ulwazi lwedijithali' },
  'Assessment': { en: 'Assessment', sh: 'Kuongorora', nd: 'Ukuhlola' },
  'Exam technique': { en: 'Exam technique', sh: 'Nzira yemabvunzo', nd: 'Ubuchule bokubhala izivivinyo' }
};
/* common Zimbabwean syllabus topics: English → ChiShona / IsiNdebele
   applied when compiling indigenous-language topics typed in English */
var TOPIC_DICT = [
  ['and', 'ne', 'le'],
  ['folktales', 'Ngano', 'Izinganekwane'],
  ['proverbs', 'Tsumo', 'Izaga'],
  ['idioms', 'Madimikira', 'Izisho'],
  ['riddles', 'Zvirahwe', 'Iziphicaphicwano'],
  ['poetry', 'Nhetembo', 'Izinkondlo'],
  ['oral poetry', 'Nhetembo dzomuromo', 'Izinkondlo zomlomo'],
  ['oral literature', 'Zvinyorwa zvomuromo', 'Imbali yomlomo'],
  ['oral traditions', 'Tsika dzokutaurwa', 'Amasiko omlomo'],
  ['storytelling', 'Kurondedzera ngano', 'Ukulandisa izindaba'],
  ['songs', 'Nziyo', 'Amaculo'],
  ['traditional songs', 'Nziyo dzechivanhu', 'Amaculo endabuko'],
  ['traditional dance', 'Kutamba kwechivanhu', 'Ukugida kwendabuko'],
  ['music', 'Mimhanzi', 'Umculo'],
  ['drama', 'Mutambo', 'Umdlalo'],
  ['theatre', 'Mutambo', 'Umdlalo'],
  ['culture', 'Tsika', 'Isiko'],
  ['traditions', 'Tsika', 'Amasiko'],
  ['customs', 'Miitiro', 'Amasiko'],
  ['heritage', 'Nhaka', 'Amagugu'],
  ['indigenous knowledge', 'Zivo yechivanhu', 'Ulwazi lwendabuko'],
  ['indigenous knowledge systems', 'Nzira dzezivo yechivanhu', 'Izinhlelo zolwazi lwendabuko'],
  ['totems', 'Mitupo', 'Izithopho'],
  ['clans', 'Madzinza', 'Izizwe'],
  ['kinship', 'Ukama', 'Ubuhlobo'],
  ['family', 'Mhuri', 'Umndeni'],
  ['marriage', 'Muchato', 'Umshado'],
  ['traditional marriage', 'Muchato wechivanhu', 'Umshado wendabuko'],
  ['initiation', 'Dzindo', 'Ukuphuphuthelwa'],
  ['ancestors', 'Vadzimu', 'Amadlozi'],
  ['ancestral spirits', 'Vadzimu', 'Amadlozi'],
  ['religion', 'Chitendero', 'Inkolo'],
  ['traditional religion', 'Chitendero chechivanhu', 'Inkolo yendabuko'],
  ['rainmaking', 'Kukumbira mvura', 'Ukwenza izulu'],
  ['witchcraft', 'Uroyi', 'Ubuthakathi'],
  ['medicine', 'Mushonga', 'Umuthi'],
  ['traditional medicine', 'Mishonga yechivanhu', 'Imithi yendabuko'],
  ['herbal medicine', 'Mushonga wemiti', 'Umuthi wezitshalo'],
  ['healers', "N'anga", 'Izinyanga'],
  ['agriculture', 'Zvekurima', 'Ezolimo'],
  ['farming', 'Kurima', 'Ukulima'],
  ['crop production', 'Kurima zvirimwa', 'Ukutshala izitshalo'],
  ['hunting', 'Kuvhima', 'Ukuzingela'],
  ['fishing', 'Kuredza', 'Ukudoba'],
  ['iron smelting', 'Kunyungudutsa simbi', 'Ukuncibilikisa insimbi'],
  ['pottery', 'Kuumba hari', 'Ukubumba izimbiza'],
  ['basketry', 'Kuruka matengu', 'Ukuluka ubhasikidi'],
  ['brewing', 'Kubika doro', 'Ukugayisa utshwala'],
  ['traditional brewing', 'Kubika doro rechivanhu', 'Ukugayisa utshwala bendabuko'],
  ['crafts', 'Mabasa emaoko', 'Imisebenzi yezandla'],
  ['art', 'Unyanzvi', 'Ubuciko'],
  ['sculpture', 'Chivezwa', 'Umfanekiso oqoshiweyo'],
  ['carving', 'Kuveza', 'Ukubaza'],
  ['weaving', 'Kuruka', 'Ukuluka'],
  ['textiles', 'Machira', 'Izindwangu'],
  ['building', 'Kuvaka', 'Ukwakha'],
  ['traditional housing', 'Dzimba dzechivanhu', 'Izindlu zendabuko'],
  ['kraal', 'Danga', 'Isibaya'],
  ['homestead', 'Musha', 'Umuzi'],
  ['village', 'Musha', 'Ubuhlali'],
  ['community', 'Nharaunda', 'Umphakathi'],
  ['chief', 'Ishe', 'Inkosi'],
  ['headman', 'Sadunhu', 'Induna'],
  ['leadership', 'Hutungamiri', 'Ubuholi'],
  ['governance', 'Hutongi', 'Ukubusa'],
  ['law', 'Mutemo', 'Umthetho'],
  ['justice', 'Ruramisiro', 'Ubulungiswa'],
  ['conflict resolution', 'Kugadzirisa kupokana', 'Ukuxazulula izingxabano'],
  ['environment', 'Zvakatipoteredza', 'Imvelo'],
  ['environmental conservation', 'Kuchengetedza zvakatipoteredza', 'Ukulondoloza imvelo'],
  ['pollution', 'Kusvibiswa', 'Ukungcoliswa'],
  ['climate change', 'Kushanduka kwemamiriro ekunze', 'Ukuguquka kwesimo sezulu'],
  ['drought', 'Rwadziko', 'Isomiso'],
  ['floods', 'Mafashamo', 'Uzamcolo'],
  ['cyclones', 'Madutu', 'Iziphepho'],
  ['disasters', 'Njodzi', 'Iingozi'],
  ['diseases', 'Zvirwere', 'Izifo'],
  ['health', 'Utano', 'Impilo'],
  ['hygiene', 'Hutsanana', 'Inhlanzeko'],
  ['sanitation', 'Hutsanana', 'Inhlanzeko'],
  ['water', 'Mvura', 'Amanzi'],
  ['waste management', 'Utariri hwemarara', 'Ukulawula imfucuza'],
  ['conservation', 'Kuchengetedza', 'Ukulondoloza'],
  ['technology', 'Tekinoroji', 'Ubuchwepheshe'],
  ['digital', 'Dijitari', 'Dijithali'],
  ['money', 'Mari', 'Imali'],
  ['budgeting', 'Kuronga mari', 'Ukuhlela isabelomali'],
  ['savings', 'Kuchengetedza mari', 'Ukulondoloza imali'],
  ['entrepreneurship', 'Kuita bhizinesi', 'Ukwenza ibhizinisi'],
  ['business', 'Bhizinesi', 'Ibhizinisi'],
  ['democracy', 'Demokirasi', 'Idemokhrasi'],
  ['constitution', 'Mutemo-mukuru', 'Umthethosisekelo'],
  ['gender', 'Bulili', 'Ubulili'],
  ['women', 'Vakadzi', 'Abesifazane'],
  ['men', 'Varume', 'Amadoda'],
  ['youth', 'Vechidiki', 'Intsha'],
  ['elders', 'Vakuru', 'Abadala'],
  ['children', 'Vana', 'Izingane'],
  ['food', 'Zvokudya', 'Ukudla'],
  ['nutrition', 'Kudya kwakanaka', 'Ukondla okuhle'],
  ['forests', 'Masango', 'Amahlathi'],
  ['soil', 'Ivhu', 'Umhlabathi'],
  ['plants', 'Zvirimwa', 'Izitshalo'],
  ['animals', 'Mhuka', 'Izilwane'],
  ['fermentation', 'Kuvirwa', 'Ukuvutshelwa'],
  ['energy', 'Simba', 'Amandla'],
  ['heat', 'Kupisa', 'Ukushisa'],
  ['weather', 'Mamiriro ekunze', 'Isimo sezulu'],
  ['soil conservation', 'Kuchengetedza ivhu', 'Ukulondoloza inhlabathi']
];
function translateTheme(theme, lang) {
  if (!lang || lang === 'en') return theme;
  var t = THEME_DICT[theme];
  return t && t[lang] ? t[lang] : theme;
}
function translateComp(comp, lang) {
  if (!lang || lang === 'en') return comp;
  var d = COMP_DICT[comp];
  return d && d[lang] ? d[lang] : comp;
}
function translateCross(cross, lang) {
  if (!lang || lang === 'en' || !cross) return cross;
  return cross.split(';').map(function (t) { return translateTheme(t.trim(), lang); }).filter(Boolean).join('; ');
}
function translateCompetencies(comps, lang) {
  if (!lang || lang === 'en' || !comps) return comps;
  return comps.map(function (c) { return translateComp(c, lang); });
}
function translateTopic(text, lang) {
  if (!lang || lang === 'en' || !text) return text;
  var result = text;
  /* longest phrases first so multi-word entries win over single words */
  var ordered = TOPIC_DICT.slice().sort(function (a, b) { return b[0].length - a[0].length; });
  ordered.forEach(function (entry) {
    var enPhrase = entry[0], shPhrase = entry[1], ndPhrase = entry[2];
    var replacement = lang === 'sh' ? shPhrase : lang === 'nd' ? ndPhrase : enPhrase;
    var re = new RegExp('\\b' + enPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(re, replacement);
  });
  return result;
}
function fillT(s, t) { return String(s).split('{T}').join(t); }
/* split a possibly lesson-suffixed topic back into base + lesson numbers */
function baseTopic(label) {
  var m = String(label || '').match(/^(.*)\s+\u2014\s+(Lesson|Chidzidzo|Isifundo)\s+(\d+)\s+(of|che|kwe)\s+(\d+)\s*$/);
  if (m) return { base: m[1].trim(), lesson: { i: parseInt(m[3], 10), n: parseInt(m[5], 10) } };
  return { base: String(label || '').trim(), lesson: null };
}
/* redraft a row's generated content in another language.
   Teacher's own writing (notes, remarks, reflection, resources, times) is kept. */
function regenerateRow(r, lang) {
  if (!GEN[lang]) lang = 'en';
  var g = GEN[lang] || GEN.en;
  var t = baseTopic(r.topic);
  var base = t.base || r.topic;
  // Translate English topic text into the target language (kept when already local)
  var topic = translateTopic(base, lang);
  r.lang = lang;
  r.topic = topic + (t.lesson ? ' \u2014 ' + g.lessonWord + ' ' + t.lesson.i + ' ' + g.ofWord + ' ' + t.lesson.n : '');
  r.cross = translateCross(r.cross, lang);
  r.objK = fillT(g.objK, topic);
  r.objS = fillT(g.objS, topic);
  r.objV = fillT(g.objV, topic);
  r.indicators = fillT(g.indicators, topic);
  r.assumed = fillT(g.assumed, topic);
  var acts = (g.methods[r.method] || g.methods['Inquiry-Based']).slice();
  r.hook = fillT(g.hook, topic);
  r.ikLink = fillT(g.ikLink, topic);
  r.act1 = fillT(acts[0], topic);
  r.act2 = fillT(acts[1], topic);
  r.act3 = fillT(acts[2], topic);
  r.closure = fillT(g.closure, topic);
  r.obs = fillT(g.obs, topic);
  r.assessMethod = fillT(g.assessMethod, topic);
  r.criteria = fillT(g.criteria, topic);
  return r;
}
/* structured topic grid in the compile modal */
var cmpCount = 0;
function topicRowHTML(i) {
  return '<div class="topic-row" data-ctrow="' + i + '">' +
    '<input type="text" id="ct-topic-' + i + '" placeholder="e.g. Temperature and Fermentation">' +
    '<input type="text" id="ct-code-' + i + '" placeholder="e.g. 5.2.4">' +
    '<input type="text" id="ct-subtopic-' + i + '" placeholder="e.g. Photosynthesis stages; light reactions">' +
    '<select id="ct-type-' + i + '"><option value="regular">Regular</option><option value="standalone">Test/Exercise</option></select>' +
    '<input type="number" id="ct-lessons-' + i + '" value="1" min="1" max="12" title="Number of lessons to complete this topic">' +
    '<input type="text" id="ct-pages-' + i + '" placeholder="e.g. 41-43">' +
    '<textarea id="ct-textbooks-' + i + '" rows="3" placeholder="e.g. New Combined Science F2, p.41-43&#10;Science Workbook, p.12"></textarea>' +
    '<button type="button" class="row-del" data-ctdel="' + i + '" title="Remove topic">\u00D7</button></div>';
}
function resetTopicRows() {
  cmpCount = 1;
  $('cmpTopicRows').innerHTML = topicRowHTML(0);
}
function readTopicRows() {
  var rows = [];
  for (var i = 0; i < cmpCount; i++) {
    var tEl = $('ct-topic-' + i);
    if (!tEl) continue;
    var topic = tEl.value.trim();
    if (!topic) continue;
    var cEl = $('ct-code-' + i);
    var sEl = $('ct-subtopic-' + i);
    var lEl = $('ct-lessons-' + i);
    var pEl = $('ct-pages-' + i);
    var tbEl = $('ct-textbooks-' + i);
    var typeEl = $('ct-type-' + i);
    var lessons = Math.min(12, Math.max(1, parseInt(lEl && lEl.value ? lEl.value : '1', 10) || 1));
    var pages = pEl ? pEl.value.trim().replace(/^pp\.?\s*/i, '') : '';
    var subtopics = sEl ? sEl.value.trim() : '';
    var textbooks = tbEl ? tbEl.value.trim() : '';
    var type = typeEl ? typeEl.value : 'regular';
    rows.push({ topic: topic, code: cEl ? cEl.value.trim() : '', lessons: lessons, pages: pages, subtopics: subtopics, textbooks: textbooks, type: type });
  }
  return rows;
}
/* cross-cutting themes matched to topic/syllabus wording */
var THEME_KEYS = {
  'ICT': ['computer', 'digital', 'data', 'ict', 'binary', 'software', 'internet', 'technology', 'tekinoroji'],
  'Environmental sustainability': ['environment', 'pollution', 'conservation', 'soil', 'water', 'forest', 'climate', 'waste', 'energy',
    'nharaunda', 'masango', 'sina', 'zvakatipoteredza', 'imvelo', 'amahlathi'],
  'HIV and AIDS': ['hiv', 'aids', 'health', 'disease', 'reproduction', 'reproductive', 'hygiene', 'stigma',
    'utano', 'zvirwere', 'zvikandemeso', 'impilo', 'izifo', 'sandulela'],
  'Gender equality': ['gender', 'women', 'men', 'girl', 'boy', 'bulili', 'vakadzi', 'varume', 'abesifazane'],
  'Human rights': ['rights', 'citizen', 'governance', 'democracy', 'constitution', 'kodzero', 'mutemo-mukuru', 'amalungelo', 'idemokhrasi'],
  'Disaster risk reduction': ['disaster', 'drought', 'flood', 'cyclone', 'safety', 'emergency',
    'njodzi', 'rwadziko', 'mafashamo', 'madutu', 'isomiso', 'uzamcolo', 'ingozi'],
  'Financial literacy': ['money', 'budget', 'business', 'market', 'profit', 'entrepreneur', 'income', 'saving',
    'mari', 'bhizinesi', 'budgeting', 'imali', 'ibhizinisi'],
  'Heritage studies': ['heritage', 'culture', 'traditional', 'indigenous', 'brewing', 'custom', 'artefact', 'artifact', 'elder',
    'nhaka', 'ngano', 'tsumo', 'dare', 'nhimbe', 'isiko', 'amasiko', 'amadlozi', 'umkhonto', 'imbongi',
    'madimikira', 'zvirahwe', 'nhetembo', 'nziyo', 'mitupo', 'dzinza', 'ukama', 'vadzimu',
    'izaga', 'izinganekwane', 'izisho', 'izinkondlo', 'amaculo', 'izithopho', 'ubuhlobo', 'amagugu', 'indabuko']
};
function detectThemes(topic, syllabus) {
  var hay = ((topic || '') + ' ' + (syllabus || '')).toLowerCase();
  var found = [];
  Object.keys(THEME_KEYS).forEach(function (t) {
    var hit = THEME_KEYS[t].some(function (k) { return hay.indexOf(k) !== -1; });
    if (hit) found.push(t);
  });
  return found;
}
/* pull Knowledge/Skills/Values objective statements out of pasted syllabus text */
function extractObjectives(text, focus) {
  var raw = String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  /* focus reference (e.g. syllabus code "5.2"): slice out that section —
     from the first matching line until the next different coded section */
  var f = (focus || '').trim().toLowerCase();
  if (f) {
    var start = -1;
    for (var i = 0; i < raw.length; i++) {
      if (raw[i].toLowerCase().indexOf(f) !== -1) { start = i; break; }
    }
    if (start !== -1) {
      var slice = [];
      for (var j = start; j < raw.length; j++) {
        var lj = raw[j];
        if (j > start && /^\d[\d.\s]*[A-Za-z]/.test(lj) && lj.toLowerCase().indexOf(f) === -1) break;
        slice.push(lj);
      }
      if (slice.join(' ').length > 20) raw = slice;
    }
  }
  var cleaned = [];
  raw.forEach(function (ln) {
    var c = ln.replace(/^[\d.)(\-\u2022\s]+/, '')
      .replace(/^(learners (should be able to|will)|by the end[^:]*:)\s*/i, '').trim();
    if (c.length < 8 || c.length > 220 || !/[a-z]/i.test(c)) return;
    if (/^(topic|theme|unit|content|objectives?)\b/i.test(c) && c.length < 40) return;
    cleaned.push({ t: c, src: ln });
  });
  /* focus reference (e.g. syllabus code "5.2"): prefer matching lines */
  var f = (focus || '').trim().toLowerCase();
  if (f) {
    var hits = cleaned.filter(function (c) {
      return c.src.toLowerCase().indexOf(f) !== -1 || c.t.toLowerCase().indexOf(f) !== -1;
    });
    if (hits.length >= 2) cleaned = hits;
  }
  var K = [], S = [], V = [];
  cleaned.forEach(function (it) {
    var low = it.t.toLowerCase();
    if (/appreciat|respect|value|attitude|awareness|care for|conserve|willingness|uphold/.test(low)) V.push(it.t);
    else if (/demonstrat|carry out|perform|conduct|construct|draw|measure|calculat|solve|make|use|prepare|set up|investigat|experiment|operate|apply/.test(low)) S.push(it.t);
    else K.push(it.t);
  });
  function cap(a) { return a.slice(0, 8).join('; '); }
  return { k: cap(K), s: cap(S), v: cap(V) };
}
/* ---------- syllabus library: save once, reference by name ---------- */
function refreshSylRefs() {
  var sel = $('cmpSylRef');
  if (!sel) return;
  var list = (lib && Array.isArray(lib.syllabi)) ? lib.syllabi : [];
  var h = '<option value="">None \u2014 type objectives manually</option>';
  h += list.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
  h += '<option value="__paste">Paste new text\u2026</option>';
  sel.innerHTML = h;
  sel.value = list.length ? list[0].id : '__paste';
  togglePasteWrap();
}
function togglePasteWrap() {
  var sel = $('cmpSylRef');
  var wrap = $('cmpPasteWrap');
  if (!sel || !wrap) return;
  if (wrap.classList) {
    if (sel.value === '__paste' || !sel.value) wrap.classList.remove('hidden');
    else wrap.classList.add('hidden');
  }
}
function renderSylList() {
  var box = $('sylList');
  if (!box) return;
  var list = (lib && Array.isArray(lib.syllabi)) ? lib.syllabi : [];
  if (!list.length) {
    box.innerHTML = '<p class="hint">No saved syllabi yet.</p>';
    return;
  }
  box.innerHTML = list.map(function (s) {
    return '<div class="attach-item"><span><strong>' + esc(s.name) + '</strong> ' +
      '<span class="hint">' + (s.text || '').length + ' chars</span></span>' +
      '<button type="button" class="link-btn" data-sydel="' + s.id + '">Delete</button></div>';
  }).join('');
}
function persistLib() { if (lib) Store.saveLib(lib); }
function compileRow(topic, code, mins, method, cross, weekNum, opt) {
  var r = blankRow();
  opt = opt || {};
  var g = GEN[opt.lang] || GEN.en;
  r.lang = opt.lang && GEN[opt.lang] ? opt.lang : 'en';
  // Translate English topics/cross-cutting themes into the document language
  var topicT = translateTopic(topic, r.lang);
  var crossT = translateCross(cross, r.lang);
  // Use base topic (without subtopics) for objectives
  var baseTopic = topicT.split('\nSub-topics:')[0];
  var label = topicT + (opt.lesson ? ' \u2014 ' + g.lessonWord + ' ' + opt.lesson : '');
  var intro = Math.max(3, Math.round(mins * 0.15));
  var concl = Math.max(3, Math.round(mins * 0.15));
  var dev = Math.max(5, mins - intro - concl);
  var a1 = Math.floor(dev / 3), a2 = Math.floor(dev / 3), a3 = dev - a1 - a2;
  var acts = (g.methods[method] || g.methods['Inquiry-Based']).slice();
  var comps = ['Critical thinking', 'Problem-solving'];
  var mc = METHOD_COMP[method];
  if (mc && comps.indexOf(mc) === -1) comps.push(mc);
  if (opt.isStandalone) {
    comps = ['Assessment', 'Exam technique'];
    acts = [
      'Complete written exercise / test on ' + baseTopic,
      'Review and self-assess answers using marking scheme',
      'Teacher provides feedback and identifies areas for improvement'
    ];
    label = baseTopic + (opt.lesson ? ' \u2014 ' + g.lessonWord + ' ' + opt.lesson : '') + ' (Test/Exercise)';
  }
  Object.assign(r, {
    method: method, week: g.weekWord + ' ' + weekNum, period: '1', minutes: String(mins),
    topic: label, cross: crossT || '',
    objK: fillT(g.objK, baseTopic),
    objS: fillT(g.objS, baseTopic),
    objV: fillT(g.objV, baseTopic),
    indicators: fillT(g.indicators, baseTopic),
    assumed: fillT(g.assumed, baseTopic),
    competencies: comps,
    refCode: code || '', resources: opt.resources || '',
    community: opt.community || '', digital: opt.digital || '', textbooks: opt.textbooks || '',
    weekEnding: opt.weekEnding || '',
    introMins: String(intro),
    hook: fillT(g.hook, baseTopic),
    ikLink: fillT(g.ikLink, baseTopic),
    devMins: String(dev),
    act1: fillT(acts[0], baseTopic), act1t: a1 + ' ' + g.minWord,
    act2: fillT(acts[1], baseTopic), act2t: a2 + ' ' + g.minWord,
    act3: fillT(acts[2], baseTopic), act3t: a3 + ' ' + g.minWord,
    conclMins: String(concl),
    closure: fillT(g.closure, baseTopic),
    obs: fillT(g.obs, baseTopic),
    assessMethod: fillT(g.assessMethod, baseTopic),
    criteria: fillT(g.criteria, baseTopic)
  });
  return r;
}
$('btnAutoCompile').addEventListener('click', function () {
  $('cmpSubject').value = state.ov.subject || '';
  var sj = (state.ov.subject || '').toLowerCase();
  $('cmpLang').value = sj.indexOf('shona') !== -1 ? 'sh' : (sj.indexOf('ndebele') !== -1 ? 'nd' : 'en');
  resetTopicRows();
  refreshSylRefs();
  $('compileModal').classList.remove('hidden');
});
if ($('cmpSylRef')) $('cmpSylRef').addEventListener('change', togglePasteWrap);
if ($('btnSylSave')) $('btnSylSave').addEventListener('click', function () {
  var name = $('sylName').value.trim();
  var text = $('sylText').value;
  if (!name) { alert('Give the syllabus a reference name.'); return; }
  if (!text.trim()) { alert('Paste the syllabus text first.'); return; }
  if (!lib) lib = Store.loadLib();
  if (!Array.isArray(lib.syllabi)) lib.syllabi = [];
  lib.syllabi.push({ id: uid(), name: name, text: text,
    updated: new Date().toISOString().slice(0, 10) });
  persistLib();
  $('sylName').value = '';
  $('sylText').value = '';
  renderSylList();
  refreshSylRefs();
});
if ($('sylList')) $('sylList').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-sydel]') : null;
  if (!b || !lib || !Array.isArray(lib.syllabi)) return;
  var id = b.getAttribute('data-sydel');
  if (!confirm('Delete this saved syllabus?')) return;
  lib.syllabi = lib.syllabi.filter(function (s) { return s.id !== id; });
  persistLib();
  renderSylList();
  refreshSylRefs();
});
$('btnAddTopicRow').addEventListener('click', function () {
  $('cmpTopicRows').insertAdjacentHTML('beforeend', topicRowHTML(cmpCount));
  cmpCount++;
});
$('cmpTopicRows').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-ctdel]') : null;
  if (!b) return;
  var row = b.closest('[data-ctrow]');
  if (row) row.remove();
});
$('btnCompileClose').addEventListener('click', function () { $('compileModal').classList.add('hidden'); });
$('compileModal').addEventListener('click', function (e) { if (e.target === $('compileModal')) $('compileModal').classList.add('hidden'); });
$('btnDoCompile').addEventListener('click', function () {
  var topics = readTopicRows();
  if (!topics.length) { alert('Add at least one topic.'); return; }
  var mins = parseInt($('cmpMinutes').value, 10) || 35;
  var method = $('cmpMethod').value || 'Inquiry-Based';
  var lang = $('cmpLang').value || 'en';
  if (!GEN[lang]) lang = 'en';
  state.docLang = lang; $('ovDocLang').value = lang;
  var crossSel = $('cmpCross').value || 'auto';
  var subj = $('cmpSubject').value.trim();
  var textbook = $('cmpTextbook').value.trim();
  var materials = $('cmpMaterials').value.trim();
  var expert = $('cmpExpert').value.trim();
  var digital = $('cmpDigital').value.trim();
  var refId = $('cmpSylRef') ? $('cmpSylRef').value : '';
  var pasted = $('cmpSyllabus').value;
  var focus = $('cmpSylFocus') ? $('cmpSylFocus').value.trim() : '';
  var syll = '';
  if (refId && refId !== '__paste' && lib && Array.isArray(lib.syllabi)) {
    lib.syllabi.forEach(function (s) { if (s.id === refId) syll = s.text || ''; });
  }
  if (!syll) syll = pasted;
  if (subj && !state.ov.subject) state.ov.subject = subj;

  // Extract term objectives from syllabus
  var filledOv = [];
  if (syll.trim()) {
    var ex = extractObjectives(syll, focus);
    if (ex.k) { state.ov.objK = ex.k; filledOv.push('Knowledge'); }
    if (ex.s) { state.ov.objS = ex.s; filledOv.push('Skills'); }
    if (ex.v) { state.ov.objV = ex.v; filledOv.push('Values'); }
  }
  syncOverviewToInputs();

  // Parse period range (e.g., "2-6" = weeks 2 to 6, "6" = 6 weeks).
  // "Starting week" overrides the start when no explicit range is given.
  var periodWeeks = ($('cmpPeriodWeeks') ? $('cmpPeriodWeeks').value : '').trim();
  var explicitStart = parseInt(($('cmpStartWeek') ? $('cmpStartWeek').value : ''), 10);
  if (isNaN(explicitStart) || explicitStart < 1) explicitStart = 0;
  var maxWeek = 0;
  state.rows.forEach(function (r) {
    var m = String(r.week || '').match(/(\d+)/);
    if (m) maxWeek = Math.max(maxWeek, parseInt(m[1], 10));
  });
  var startWeek, endWeek;
  if (periodWeeks.includes('-')) {
    var parts = periodWeeks.split('-').map(function (s) { return parseInt(s.trim(), 10); });
    startWeek = explicitStart > 0 ? explicitStart : (parts.length === 2 && !isNaN(parts[0]) ? parts[0] : maxWeek + 1);
    endWeek = parts.length === 2 && !isNaN(parts[1]) && parts[1] >= startWeek ? parts[1] : startWeek;
  } else if (periodWeeks !== '') {
    var n = parseInt(periodWeeks, 10);
    startWeek = explicitStart > 0 ? explicitStart : maxWeek + 1;
    endWeek = !isNaN(n) && n > 0 ? startWeek + n - 1 : startWeek;
  } else {
    // No explicit period: continue from highest existing week, or user-specified start
    startWeek = explicitStart > 0 ? explicitStart : maxWeek + 1;
    endWeek = startWeek;
  }

  // Week ending dates (optional)
  var weekEndingStr = ($('cmpWeekEnding') ? $('cmpWeekEnding').value : '').trim();
  var weekEndings = [];
  if (weekEndingStr) {
    weekEndings = weekEndingStr.split(',').map(function (s) { return s.trim(); });
  }
  // If no week endings given but term start/end dates provided, generate weekly dates
  if (weekEndings.length === 0) {
    var termStart = ($('cmpTermStart') ? $('cmpTermStart').value : '') || '';
    var termEnd = ($('cmpTermEnd') ? $('cmpTermEnd').value : '') || '';
    if (termStart && termEnd) {
      var dStart = new Date(termStart);
      var dEnd = new Date(termEnd);
      // Find first Friday (or last day of week) from start
      while (dStart.getDay() !== 5) dStart.setDate(dStart.getDate() + 1);
      var curr = new Date(dStart);
      while (curr <= dEnd && weekEndings.length < (endWeek - startWeek + 1)) {
        weekEndings.push(curr.toISOString().slice(0, 10));
        curr.setDate(curr.getDate() + 7);
      }
    }
  }

  // Lessons per week
  var lessonsPerWeek = parseInt($('cmpLessonsPerWeek') ? $('cmpLessonsPerWeek').value : '1', 10) || 1;

  // Calculate total lessons across all topics
  var totalLessons = topics.reduce(function (sum, p) { return sum + (p.lessons || 1); }, 0);
  var totalWeeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
  // Use the greater of user-specified end week or calculated needed weeks
  endWeek = Math.max(endWeek, startWeek + totalWeeksNeeded - 1);

  var ofW = (GEN[lang] || GEN.en).ofWord;
  var currentWeek = startWeek;
  var lessonsInCurrentWeek = 0;
  var weekIdx = 0;

  topics.forEach(function (p) {
    var cross = crossSel === 'auto' ? detectThemes(p.topic, syll).join('; ') : crossSel;
    var perTopicTextbooks = p.textbooks ? p.textbooks.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).join('\n') : '';
    var syllabusPages = p.pages ? 'Syllabus pp. ' + p.pages : '';
    var tbParts = [];
    if (textbook) tbParts.push(textbook);
    if (perTopicTextbooks) tbParts.push(perTopicTextbooks);
    if (syllabusPages) tbParts.push(syllabusPages);
    var tb = tbParts.join('\n');
    var topicLabel = p.topic + (p.subtopics ? '\nSub-topics: ' + p.subtopics : '');
    var g = GEN[lang] || GEN.en;
    var lessonsToCreate = p.type === 'standalone' ? 1 : p.lessons;
    for (var i = 1; i <= lessonsToCreate; i++) {
      var thisWeekEnding = weekEndings[weekIdx] || '';
      state.rows.push(compileRow(topicLabel, p.code, mins, method, cross, currentWeek, {
        lang: lang,
        lesson: (g.lessonWord + ' ' + i + ' ' + ofW + ' ' + lessonsToCreate),
        textbooks: tb, resources: materials, community: expert, digital: digital,
        weekEnding: thisWeekEnding,
        isStandalone: p.type === 'standalone'
      }));
      lessonsInCurrentWeek++;
      if (lessonsInCurrentWeek >= lessonsPerWeek) {
        currentWeek++;
        lessonsInCurrentWeek = 0;
        weekIdx++;
      }
    }
  });
  save(); renderEntries(); renderPreview();
  $('compileModal').classList.add('hidden');
  var msg = 'Drafted ' + totalLessons + ' lessons over ' + (endWeek - startWeek + 1) + ' weeks (Week ' + startWeek + '-' + endWeek + ') from ' + topics.length +
    (topics.length === 1 ? ' topic.' : ' topics.') + ' Review and edit each draft.';
  if (filledOv.length) msg += ' Term overview filled from syllabus: ' + filledOv.join(', ') + '.';
  alert(msg);
});

/* evaluation sub-block: generated prompt + teacher self-evaluation space */
/* evaluation sub-block: show subheading + teacher's own evaluation space */
function evalBlock(label, gen, note) {
  var out = '<div><span class="sub">' + esc(label) + ':</span></div>';
  if ((note || '').trim()) out += '<div><em>' + br(note) + '</em></div>';
  out += '<div class="remark-lines"><span></span><span></span><span></span></div>';
  return out;
}

/* ---------- preview + quality check ---------- */
function sub(label, val) {
  if (!val || !String(val).trim()) return '';
  return '<div><span class="sub">' + esc(label) + ':</span> ' + br(val) + '</div>';
}
function acts(list) {  var items = list.filter(function (a) { return a[0] && String(a[0]).trim(); });
  if (!items.length) return '';
  return '<ul>' + items.map(function (a) {
    return '<li>' + br(a[0]) + (a[1] && String(a[1]).trim() ? ' <em>(' + esc(a[1]) + ')</em>' : '') + '</li>';
  }).join('') + '</ul>';
}

function renderPreview() {
  var o = state.ov;
  $('docTitle').textContent = D('doc_title');
  var ths = [['th_week', 'col_week'], ['th_topic', 'col_topic'], ['th_obj', 'col_obj'],
             ['th_comp', 'col_comp'], ['th_ref', 'col_ref'], ['th_meth', 'col_meth'], ['th_eval', 'col_eval']];
  ths.forEach(function (t) { var el = $(t[0]); if (el) el.textContent = D(t[1]); });
  $('signTeacher').textContent = D('sign_teacher');
  $('signHod').textContent = D('sign_hod');
  $('signHead').textContent = D('sign_head');
  $('signDate').textContent = D('sign_date');
  $('previewOverview').innerHTML =
    '<p><strong>' + esc(D('school')) + '</strong> ' + br(o.school) + ' &nbsp; <strong>' + esc(D('subject')) + '</strong> ' + br(o.subject) +
    ' &nbsp; <strong>' + esc(D('grade')) + '</strong> ' + br(o.grade) + '<br>' +
    '<strong>' + esc(D('teacher')) + '</strong> ' + br(o.teacher) + ' &nbsp; <strong>' + esc(D('term')) + '</strong> ' + br(o.term) +
    ' &nbsp; <strong>' + esc(D('year')) + '</strong> ' + br(o.year) + '</p>' +
    '<p><strong>' + esc(D('termObj')) + '</strong><br>' +
    '<strong>' + esc(D('knowledge')) + ':</strong> ' + br(o.objK) + '<br>' +
    '<strong>' + esc(D('skills')) + ':</strong> ' + br(o.objS) + '<br>' +
    '<strong>' + esc(D('values')) + ':</strong> ' + br(o.objV) + '</p>' +
    (o.community && o.community.trim() ? '<p><strong>' + esc(D('community')) + '</strong> ' + br(o.community) + '</p>' : '');

  $('schemeBody').innerHTML = state.rows.map(function (r) {
    var week = [r.week, r.period ? D('period') + ' ' + r.period : '', r.minutes ? '(' + r.minutes + ' ' + D('minutes') + ')' : '', r.weekEnding ? '<br>' + D('weekEnding') + ': ' + esc(r.weekEnding) : '']
      .filter(Boolean).join('<br>');
    var docL = (state.docLang && GEN[state.docLang]) ? state.docLang : 'en';
    var topic = br(r.topic) + (r.cross && r.cross.trim() ? '<div><span class="sub">' + esc(D('cross')) + '</span> ' + br(translateCross(r.cross, docL)) + '</div>' : '');
    var obj = sub(D('knowledge'), r.objK) + sub(D('skills'), r.objS) + sub(D('values'), r.objV) +
              sub(D('indicators'), r.indicators) + sub(D('assumed'), r.assumed);
    var comp = r.competencies.length
      ? '<ul>' + translateCompetencies(r.competencies, docL).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '';
    var ref = sub(D('syllabus'), r.refCode) + sub(D('resources'), r.resources) +
              sub(D('expert'), r.community) + sub(D('digital'), r.digital) + sub(D('textbooks'), r.textbooks);
    var meth = (r.introMins || r.hook || r.ikLink)
        ? '<div><span class="sub">' + esc(D('intro')) + (r.introMins ? ' (' + esc(r.introMins) + ' ' + esc(D('min')) + ')' : '') + ':</span> ' + br([r.hook, r.ikLink].filter(Boolean).join('\n')) + '</div>' : '';
    meth += (r.devMins || r.act1 || r.act2 || r.act3)
        ? '<div style="margin-top:4px"><span class="sub">' + esc(D('dev')) + (r.devMins ? ' (' + esc(r.devMins) + ' ' + esc(D('min')) + ')' : '') + ':</span>' +
          acts([[r.act1, r.act1t], [r.act2, r.act2t], [r.act3, r.act3t]]) + '</div>' : '';
    meth += r.closure
        ? '<div style="margin-top:4px"><span class="sub">' + esc(D('concl')) + (r.conclMins ? ' (' + esc(r.conclMins) + ' ' + esc(D('min')) + ')' : '') + ':</span> ' + br(r.closure) + '</div>' : '';
    var refl = [r.rAchieve, r.rWorked && (D('r_worked') + r.rWorked), r.rTiming && (D('r_timing') + r.rTiming),
                r.rResources && (D('r_resources') + r.rResources), r.rModify && (D('r_modify') + r.rModify),
                r.rFollow && (D('r_follow') + r.rFollow)].filter(Boolean).join('\n');
    var ev = evalBlock(D('obs'), r.obs, r.rObsNote) +
             evalBlock(D('assess'), r.assessMethod, r.rAssessNote) +
             evalBlock(D('criteria'), r.criteria, r.rCritNote) +
             (refl ? '<div><span class="sub">' + esc(D('reflection')) + '</span><br>' + br(refl) + '</div>' : '') +
             sub(D('remarks'), r.rRemarks);
    return '<tr><td>' + week + '</td><td>' + topic + '</td><td>' + obj + '</td><td>' + comp +
           '</td><td>' + ref + '</td><td>' + meth + '</td><td>' + ev + '</td></tr>';
  }).join('');

  /* quality check */
  var checks = [
    ['week', 'Week/Period'], ['topic', 'Topic'], ['objK', 'Objective: Knowledge'],
    ['indicators', 'Objective: Indicators'], ['refCode', 'Syllabus code'],
    ['hook', 'Introduction hook'], ['closure', 'Conclusion / exit card'],
    ['obs', 'Evaluation: Observation'], ['assessMethod', 'Evaluation: Assessment method'],
    ['criteria', 'Evaluation: Criteria']
  ];
  var issues = [];
  state.rows.forEach(function (r, i) {
    var miss = checks.filter(function (c) { return !r[c[0]] || !String(r[c[0]]).trim(); }).map(function (c) { return c[1]; });
    if (!r.competencies.length) miss.push('Competences');
    if (!r.act1.trim() && !r.act2.trim() && !r.act3.trim()) miss.push('Development activities');
    if (miss.length) issues.push('Entry ' + (i + 1) + ': missing ' + miss.join(', '));
  });
  $('qualityBox').innerHTML = issues.length
    ? '<h3>Completeness check</h3><ul><li>' + issues.map(esc).join('</li><li>') + '</li></ul>'
    : '<p class="ok">Completeness check: all entries have the required fields. \u2713</p>';
}
var previewSoon = debounce(renderPreview, 350);

/* ---------- repository (IndexedDB) ---------- */
var DB = 'scpb-repo', STORE = 'files';
var repoOK = true, repoFilter = 'all', attachTarget = null, objUrls = [];

function idbOpen() {
  return new Promise(function (res, rej) {
    var q = indexedDB.open(DB, 1);
    q.onupgradeneeded = function () { q.result.createObjectStore(STORE, { keyPath: 'id' }); };
    q.onsuccess = function () { res(q.result); };
    q.onerror = function () { rej(q.error); };
  });
}
function idbPut(rec) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = function () { db.close(); res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function idbGet(id) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(STORE, 'readonly');
      var q = tx.objectStore(STORE).get(id);
      q.onsuccess = function () { db.close(); res(q.result); };
      q.onerror = function () { rej(tx.error); };
    });
  });
}
function idbDel(id) {
  return idbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = function () { db.close(); res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}

$('btnUpload').addEventListener('click', function () {
  var files = $('fileInput').files;
  if (!files.length) { $('repoStatus').textContent = 'Choose one or more files first.'; return; }
  var kind = $('fileKind').value;
  var chain = Promise.resolve();
  Array.prototype.forEach.call(files, function (f) {
    chain = chain.then(function () {
      var meta = { id: uid(), name: f.name, kind: kind, size: f.size, type: f.type || '',
        added: new Date().toISOString().slice(0, 10), owner: Store.pid() };
      var store = repoOK ? idbPut({ id: meta.id, blob: f }).catch(function () { repoOK = false; }) : Promise.resolve();
      return store.then(function () {
        if (!repoOK) meta.sessionOnly = true;
        state.repoMeta.push(meta);
      });
    });
  });
  chain.then(function () {
    save(); renderRepo(); $('fileInput').value = '';
    $('repoStatus').textContent = repoOK
      ? 'Uploaded. Files persist in this browser.'
      : 'IndexedDB unavailable: files kept for this session only.';
  });
});

Array.prototype.forEach.call(document.querySelectorAll('.repo-filters .chip'), function (ch) {
  ch.addEventListener('click', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.repo-filters .chip'), function (x) { x.classList.remove('active'); });
    ch.classList.add('active');
    repoFilter = ch.getAttribute('data-filter');
    renderRepo();
  });
});

function renderRepo() {
  var mine = Store.pid();
  var list = state.repoMeta
    .filter(function (m) { return !m.owner || m.owner === mine; })
    .filter(function (m) { return repoFilter === 'all' || m.kind === repoFilter; });
  if (!list.length) {
    $('repoBody').innerHTML = '<tr><td colspan="4" class="hint">No documents stored yet. Upload syllabus and textbooks above.</td></tr>';
    return;
  }
  $('repoBody').innerHTML = list.map(function (m) {
    return '<tr><td>' + esc(m.name) + (m.sessionOnly ? ' <span class="hint">(session only)</span>' : '') + '</td>' +
      '<td><span class="badge ' + esc(m.kind) + '">' + esc(m.kind) + '</span></td>' +
      '<td>' + esc(fmtSize(m.size)) + '</td>' +
      '<td><button type="button" class="link-btn" data-repo="view" data-id="' + m.id + '">View</button>' +
      '<button type="button" class="link-btn" data-repo="dl" data-id="' + m.id + '">Download</button>' +
      '<button type="button" class="link-btn" data-repo="del" data-id="' + m.id + '">Delete</button></td></tr>';
  }).join('');
}

$('repoBody').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-repo]') : null;
  if (!b) return;
  var id = b.getAttribute('data-id'), op = b.getAttribute('data-repo');
  var meta = null;
  state.repoMeta.forEach(function (m) { if (m.id === id) meta = m; });
  if (!meta) return;
  if (op === 'del') {
    if (!confirm('Delete "' + meta.name + '" from the repository?')) return;
    idbDel(id).catch(function () {});
    state.repoMeta = state.repoMeta.filter(function (m) { return m.id !== id; });
    save(); renderRepo(); return;
  }
  idbGet(id).then(function (rec) {
    if (!rec) { alert('File content not found in this browser (it may have been a session-only upload).'); return; }
    if (op === 'dl') { download(rec.blob, meta.name); return; }
    openFileModal(meta, rec.blob);
  }).catch(function () { alert('Could not read the stored file.'); });
});

function openFileModal(meta, blob) {
  closeFileModal();
  $('fileModalTitle').textContent = meta.name;
  var url = URL.createObjectURL(blob); objUrls.push(url);
  var body = $('fileModalBody'), t = (meta.type || '').toLowerCase(), n = meta.name.toLowerCase();
  if (t.indexOf('pdf') !== -1 || /\.pdf$/.test(n)) {
    body.innerHTML = '<iframe src="' + url + '" style="width:100%;height:60vh;border:1px solid #ccc"></iframe>';
  } else if (/^image\//.test(t) || /\.(png|jpe?g|gif|webp)$/.test(n)) {
    body.innerHTML = '<img src="' + url + '" style="max-width:100%" alt="">';
  } else if (/^video\//.test(t) || /\.mp4$/.test(n)) {
    body.innerHTML = '<video src="' + url + '" controls style="max-width:100%"></video>';
  } else {
    body.innerHTML = '<p class="hint">Preview not available for this file type.</p>' +
      '<p><a href="' + url + '" download="' + esc(meta.name) + '">Download to open</a></p>';
  }
  $('fileModal').classList.remove('hidden');
}
function closeFileModal() {
  $('fileModal').classList.add('hidden');
  $('fileModalBody').innerHTML = '';
  objUrls.forEach(function (u) { URL.revokeObjectURL(u); });
  objUrls = [];
}
$('btnFileClose').addEventListener('click', closeFileModal);
$('fileModal').addEventListener('click', function (e) { if (e.target === $('fileModal')) closeFileModal(); });

/* attach from repository */
function openAttachModal(rowId) {
  attachTarget = rowId;
  var mine = Store.pid();
  var files = state.repoMeta.filter(function (m) { return !m.owner || m.owner === mine; });
  if (!files.length) {
    $('attachList').innerHTML = '<p class="hint">Repository is empty. Upload syllabus / textbooks in the Media Repository tab first.</p>';
  } else {
    $('attachList').innerHTML = files.map(function (m) {
      return '<div class="attach-item"><span>' + esc(m.name) + ' <span class="badge ' + esc(m.kind) + '">' + esc(m.kind) + '</span></span>' +
        '<button type="button" class="btn small" data-attach="' + m.id + '">Attach</button></div>';
    }).join('');
  }
  $('attachModal').classList.remove('hidden');
}
$('attachList').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-attach]') : null;
  if (!b || !attachTarget) return;
  var meta = null;
  state.repoMeta.forEach(function (m) { if (m.id === b.getAttribute('data-attach')) meta = m; });
  var hit = findRow(attachTarget);
  if (meta && hit) {
    var line = meta.name + ' (pp. )';
    hit.r.textbooks = (hit.r.textbooks ? hit.r.textbooks.replace(/\s+$/, '') + '\n' : '') + line;
    save(); renderEntries(); renderPreview();
  }
  $('attachModal').classList.add('hidden');
});
$('btnAttachClose').addEventListener('click', function () { $('attachModal').classList.add('hidden'); });
$('attachModal').addEventListener('click', function (e) { if (e.target === $('attachModal')) $('attachModal').classList.add('hidden'); });

/* ---------- exports ---------- */
function doPrint() { renderPreview(); window.print(); }
$('btnPrint').addEventListener('click', doPrint);
$('btnPrint2').addEventListener('click', doPrint);
$('btnPrintTop').addEventListener('click', doPrint);

function fileBase() {
  var o = state.ov;
  return ('scheme-cum-plan_' + (o.subject || 'subject') + '_' + (o.grade || 'grade') + '_term' + (o.term || ''))
    .replace(/[^\w\-]+/g, '_');
}
function docHTML() {
  var o = state.ov;
  var css = 'table{border-collapse:collapse;width:100%;font-size:11px}' +
    'th{background:#d9a441;border:1px solid #6b1f1f;padding:4px;text-align:left;vertical-align:top}' +
    'td{border:1px solid #6b1f1f;padding:4px;vertical-align:top}h1{color:#6b1f1f}';
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="UTF-8"><style>' + css + '</style></head><body>' +
    '<p><strong>Ministry of Primary and Secondary Education &mdash; ZIMBABWE</strong></p>' +
    '<h1>' + esc(D('doc_title')) + '</h1>' + $('previewOverview').innerHTML +
    '<table><thead><tr>' +
    ['col_week', 'col_topic', 'col_obj', 'col_comp', 'col_ref', 'col_meth', 'col_eval']
      .map(function (k) { return '<th>' + esc(D(k)) + '</th>'; }).join('') +
    '</tr></thead><tbody>' + $('schemeBody').innerHTML + '</tbody></table>' +
    '<p>' + esc(D('sign_teacher')) + ' ____________________ &nbsp; ' + esc(D('sign_hod')) + ' ____________________ &nbsp; ' +
    esc(D('sign_head')) + ' ____________________ &nbsp; ' + esc(D('sign_date')) + ' ____________________</p>' +
    '</body></html>';
}
function doWord() {
  renderPreview();
  download(new Blob(['\ufeff' + docHTML()], { type: 'application/msword' }), fileBase() + '.doc');
}
$('btnWord').addEventListener('click', doWord);
$('btnWord2').addEventListener('click', doWord);
$('btnWordTop').addEventListener('click', doWord);

function csvCell(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; }
function rowCSV(r) {
  function L(k) { return D(k).replace(/:\s*$/, ''); }
  var rl = (r.lang && GEN[r.lang]) ? r.lang : 'en';
  var week = [r.week, r.period, r.minutes, r.weekEnding].filter(Boolean).join(' | ');
  var obj =
    [L('knowledge') + ': ' + r.objK, L('skills') + ': ' + r.objS, L('values') + ': ' + r.objV,
     L('indicators') + ': ' + r.indicators, L('assumed') + ': ' + r.assumed].join(' | ');
  var ref = [L('syllabus') + ': ' + r.refCode, L('resources') + ': ' + r.resources, L('expert') + ': ' + r.community,
             L('digital') + ': ' + r.digital, L('textbooks') + ': ' + r.textbooks].join(' | ');
  var meth = [L('intro') + '(' + r.introMins + '): ' + r.hook + ' / ' + r.ikLink,
              L('dev') + '(' + r.devMins + '): ' + r.act1 + ' [' + r.act1t + ']; ' + r.act2 + ' [' + r.act2t + ']; ' + r.act3 + ' [' + r.act3t + ']',
              L('concl') + '(' + r.conclMins + '): ' + r.closure].join(' | ');
  var ev = [L('obs') + ': ' + r.obs, L('assess') + ': ' + r.assessMethod,
            L('criteria') + ': ' + r.criteria, L('remarks') + ': ' + (r.rRemarks || '')].join(' | ');
  var crossT = translateCross(r.cross, rl);
  return [week, r.topic + (crossT ? ' [' + L('cross') + ' ' + crossT + ']' : ''), obj,
          translateCompetencies(r.competencies, rl).join('; '), ref, meth, ev].map(csvCell).join(',');
}
function doCsv() {
  var head = ['col_week', 'col_topic', 'col_obj', 'col_comp', 'col_ref', 'col_meth', 'col_eval']
    .map(function (k) { return D(k).replace(/\s*\/\s*/g, '/'); }).map(csvCell).join(',');
  var body = state.rows.map(rowCSV).join('\r\n');
  var o = state.ov;
  var pre = csvCell(L('school') + ' ' + o.school + ' | ' + L('subject') + ' ' + o.subject + ' | ' + L('grade') + ' ' + o.grade +
                    ' | ' + L('teacher') + ' ' + o.teacher + ' | ' + L('term') + ' ' + o.term + ' | ' + L('year') + ' ' + o.year) + '\r\n';
  function L(k) { return D(k).replace(/:\s*$/, ''); }
  download(new Blob(['\ufeff' + pre + head + '\r\n' + body], { type: 'text/csv' }), fileBase() + '.csv');
}
$('btnCsv').addEventListener('click', doCsv);
$('btnCsv2').addEventListener('click', doCsv);

$('btnExportJson').addEventListener('click', function () {
  download(new Blob([JSON.stringify({ name: state.name, ov: state.ov, rows: state.rows, docLang: state.docLang,
    syllabi: (lib && Array.isArray(lib.syllabi)) ? lib.syllabi : [] }, null, 2)],
    { type: 'application/json' }), fileBase() + '.json');
});
$('importJson').addEventListener('change', function () {
  var f = $('importJson').files[0];
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.rows)) throw new Error('bad file');
      if (d.name) { state.name = d.name; $('ovName').value = d.name; }
      if (d.docLang && DOC.col_obj[d.docLang]) { state.docLang = d.docLang; $('ovDocLang').value = d.docLang; }
      if (Array.isArray(d.syllabi) && lib) { lib.syllabi = d.syllabi; persistLib(); }
      if (d.ov) state.ov = Object.assign(blankOverview(), d.ov);
      state.rows = d.rows.map(function (r) { return Object.assign(blankRow(), r); });
      syncOverviewToInputs(); save(); renderEntries(); renderSylList(); refreshSylRefs(); renderPreview();
      alert('Backup imported (' + state.rows.length + ' entries).');
    } catch (e) { alert('Could not import: invalid backup file.'); }
    $('importJson').value = '';
  };
  rd.readAsText(f);
});
$('btnClearAll').addEventListener('click', function () {
  if (!confirm('Delete ALL overview data and entries in this scheme? (Repository files are kept.)')) return;
  state.name = 'My Scheme-Cum-Plan'; $('ovName').value = state.name;
  state.ov = blankOverview(); state.rows = [];
  syncOverviewToInputs(); save(); renderEntries(); renderPreview();
});
$('btnLogout').addEventListener('click', function () {
  save();
  Auth.logout();
  if (typeof location !== 'undefined') location.href = 'login.html';
});
$('ovName').addEventListener('input', function () {
  state.name = $('ovName').value; save();
});
$('ovDocLang').addEventListener('change', function () {
  state.docLang = $('ovDocLang').value || 'en';
  save(); renderPreview();
});

// Edit mode handlers
function setEditMode(mode) {
  state.editMode = mode;
  var viewBtn = $('btnModeView');
  var editBtn = $('btnModeEdit');
  var delBtn = $('btnModeDelete');
  if (viewBtn) viewBtn.disabled = (mode !== 'view');
  if (editBtn) editBtn.disabled = (mode !== 'edit');
  if (delBtn) delBtn.disabled = (mode !== 'delete');
  renderEntries();
}
if ($('btnModeView')) $('btnModeView').addEventListener('click', function () { setEditMode('view'); });
if ($('btnModeEdit')) $('btnModeEdit').addEventListener('click', function () { setEditMode('edit'); });
if ($('btnModeDelete')) $('btnModeDelete').addEventListener('click', function () { setEditMode('delete'); });

/* ---------- init ---------- */
function isFreshState() {  if ((state.ov.school || '') !== '' || (state.ov.subject || '') !== '') return false;  if ((state.ov.school || '') !== '' || (state.ov.subject || '') !== '') return false;
  if (state.rows.length > 1) return false;
  return state.rows.every(function (r) {
    return !(r.topic || '').trim() && !(r.objK || '').trim() && !(r.textbooks || '').trim();
  });
}
if (!('indexedDB' in window)) {
  repoOK = false;
  $('repoStatus').textContent = 'IndexedDB not supported: uploads kept for this session only.';
}
/* require a logged-in session (teachers and admin alike; data is per-profile) */
var me = null;
try { me = Auth.current(); } catch (e) { me = null; }
if (!me && typeof location !== 'undefined' && location.href && location.href.indexOf('login.html') === -1) {
  location.href = 'login.html';
  return;
}
load();
if (!state.ov.year) state.ov.year = '2026';
if (typeof location !== 'undefined' && location.search && location.search.indexOf('demo=1') !== -1 && isFreshState()) {
  var demo = workedExampleFull();
  state.ov = demo.ov;
  state.rows = [demo.row,
    compileRow('Photosynthesis', '6.1', 35, 'Experiential / Hands-on', 'Environmental sustainability', 4),
    compileRow('Acids and Bases', '7.3', 35, 'Experiential / Hands-on', 'Environmental sustainability', 5)];
}
syncOverviewToInputs();
$('ovName').value = state.name || '';
$('ovDocLang').value = state.docLang || 'en';
// Don't add blank row on init - let user add entries or use auto-compile
renderEntries();
renderRepo();
renderSylList();
renderPreview();
applyLang();
if (typeof location !== 'undefined' && location.hash) {
  activateTab(location.hash.replace('#', ''));
}
/* hook for automated checks */
if (typeof window !== 'undefined') {
  window.__scpb = { state: state, renderPreview: renderPreview, renderEntries: renderEntries, applyLang: applyLang, STR: STR, DOC: DOC, D: D, regenerateRow: regenerateRow, baseTopic: baseTopic, translateTopic: translateTopic, translateCross: translateCross, translateComp: translateComp, translateCompetencies: translateCompetencies, lib: function () { return lib; } };
}
var APP_VERSION = '1.9.0';
if ($('appVer')) $('appVer').textContent = 'v' + APP_VERSION;
$('uiLang').addEventListener('change', function () {
  state.uiLang = $('uiLang').value || 'en';
  save(); applyLang(); renderEntries();
});

})();
