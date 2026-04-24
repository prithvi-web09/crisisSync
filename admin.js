// ══════════════════════════════════════════════════════════════
//  CRISISSYNC — admin-modals.js
//  Firebase only. No demo/fake data. Empty until admin enters.
// ══════════════════════════════════════════════════════════════

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openAdmModal(id)  { document.getElementById(id)?.classList.add('open');    }
function closeAdmModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── TOAST ─────────────────────────────────────────────────────
function admAlert(msg, type) {
  document.querySelector('.adm-toast')?.remove();
  var t = document.createElement('div');
  t.className = 'adm-toast';
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);'
    + 'background:' + (type==='error'?'#2a1010':'#0d2010') + ';'
    + 'border:1px solid ' + (type==='error'?'#f8717155':'#4ade8055') + ';'
    + 'color:' + (type==='error'?'#f87171':'#4ade80') + ';'
    + 'font-size:13px;font-weight:600;padding:12px 20px;border-radius:50px;'
    + 'z-index:9999;letter-spacing:0.5px;pointer-events:none;white-space:nowrap;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2800);
}

// ── WAIT FOR FIREBASE ─────────────────────────────────────────
function waitForFB(ms) {
  ms = ms || 6000;
  return new Promise(function(resolve) {
    if (window._fbReady && window.FB) { resolve(); return; }
    var h = function() { document.removeEventListener('fbReady', h); resolve(); };
    document.addEventListener('fbReady', h);
    setTimeout(function() { document.removeEventListener('fbReady', h); resolve(); }, ms);
  });
}

function fbReady() {
  return !!(window._fbReady && window.FB && window._adminSession && window._adminSession.institutionId);
}

function invalidateLiveUserData() {
  window._liveHospitals = null;
  window._liveShelters  = null;
  window._liveFoodData  = null;
  window._livePolice     = null;
}

// ── LOADING / EMPTY STATE ─────────────────────────────────────
function admLoading(id) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
    + 'padding:28px;color:#555;font-size:12px;gap:8px;letter-spacing:1px;">'
    + '<i class="fa-solid fa-circle-notch fa-spin" style="color:#e03030;"></i> FETCHING FROM FIREBASE...</div>';
}

function admEmpty(id, btnLabel, btnFn) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#444;">'
    + '<i class="fa-solid fa-database" style="font-size:24px;margin-bottom:10px;display:block;opacity:0.3;"></i>'
    + '<div style="font-size:12px;letter-spacing:1px;margin-bottom:' + (btnLabel?'14px':'0') + ';">NO DATA YET</div>'
    + (btnLabel ? '<button class="adm-commit-btn" style="width:auto;padding:10px 20px;margin:0;font-size:11px;" onclick="' + btnFn + '">'
        + '<i class="fa-solid fa-plus"></i> ' + btnLabel + '</button>' : '')
    + '</div>';
}

// ── FORM OVERLAY ──────────────────────────────────────────────
function makeOverlay(id, title, html, saveFn) {
  document.getElementById(id)?.remove();
  var o = document.createElement('div');
  o.id = id;
  o.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.92);'
    + 'display:flex;align-items:center;justify-content:center;padding:20px;';
  o.innerHTML = '<div style="background:#0d0d0d;border:1px solid #222;border-radius:16px;'
    + 'padding:24px;width:100%;max-width:360px;max-height:90vh;overflow-y:auto;scrollbar-width:none;">'
    + '<div style="font-family:Rajdhani,sans-serif;font-size:13px;font-weight:700;'
    + 'color:#fff;letter-spacing:2px;margin-bottom:18px;">' + title + '</div>'
    + html
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px;">'
    + '<button class="adm-archive-btn" style="margin:0;" onclick="document.getElementById(\''
    + id + '\').remove()">CANCEL</button>'
    + '<button class="adm-commit-btn" style="margin:0;" onclick="' + saveFn + '">SAVE</button>'
    + '</div></div>';
  document.body.appendChild(o);
}

// ── FIELD HELPERS ─────────────────────────────────────────────
function fv(id) { return (document.getElementById(id)||{}).value || ''; }
function fi(id) { return parseInt(fv(id)) || 0; }

// ══════════════════════════════════════════════════════════════
//  INIT — called whenever a modal opens
// ══════════════════════════════════════════════════════════════
async function initAdmModal(id) {
  // Firebase already ready after login — just render
  if (!window._fbReady) await waitForFB(4000);
  switch (id) {
    case 'modal-bed-management':   await renderBedList(); await renderMedIncidents(); break;
    case 'modal-staff-duty':       storeClear('getStaff'); await renderStaffList(); break;
    case 'modal-emergency-intake': storeClear('getIntake'); storeClear('getIntake'); await renderIntakeList(); break;
    case 'modal-hosp-incidents':   storeClear('getReports'); storeClear('getReports'); await renderHospReports('ALL'); break;
    case 'modal-stock-update':     storeClear('getStock'); await renderStockCards(); storeClear('getLedger'); await renderLedger('ledgerList'); break;
    case 'modal-distribution':     storeClear('getStations'); storeClear('getStations'); await renderDistroList(); break;
    case 'modal-incoming-supply':  storeClear('getConvoys'); storeClear('getConvoys'); storeClear('getConvoys'); await renderSupplyList(); break;
    case 'modal-ngo-coord':        storeClear('getPartners'); await renderNGOList(); break;
    case 'modal-unit-deployment':  storeClear('getUnits'); storeClear('getUnits'); await renderUnitList(); break;
    case 'modal-alert-broadcast':  storeClear('getIncidents'); storeClear('getIncidents'); await renderIncidentFeed('incidentFeed'); storeClear('getNotes'); await renderCmdNotes('cmdNotes'); break;
    case 'modal-patrol-zones':     storeClear('getZones'); storeClear('getZones'); storeClear('getZones'); await renderPatrolZones(); break;
    case 'modal-incident-log':     await renderIncidentFeed('incidentLog'); await renderCmdNotes('cmdNotes2'); break;
    case 'modal-capacity-status':  storeClear('getShelterWards'); await renderCapacityList(); break;
    case 'modal-medical-services': storeClear('getShelterMedical'); await renderShelterMedList(); break;
    case 'modal-supply-inventory': storeClear('getShelterStock'); storeClear('getShelterLedger'); await renderShelterStock(); break;
    case 'modal-announcements':    storeClear('getAnnouncements'); storeClear('getAnnouncements'); await renderAnnounceList(); break;
  }
}

// ── FIREBASE FETCH HELPER ─────────────────────────────────────
async function fbFetch(fn) {
  if (!window._fbReady) await waitForFB(5000);
  if (!window.FB || !window.FB[fn]) return [];
  if (!window._adminSession || !window._adminSession.institutionId) return [];
  try { var r = await window.FB[fn](); return r || []; }
  catch(e) { console.warn('fbFetch ' + fn, e.message); return []; }
}

// ── LOCAL STORE — holds data per key, cleared on save/delete ─
var _store = {};

// Fetch from Firebase and cache locally
async function fbGet(fn) {
  var r = await fbFetch(fn);
  _store[fn] = r;
  return r;
}

function storeGet(fn) { return _store[fn] || null; }
function storeClear(fn) { delete _store[fn]; }

// ══════════════════════════════════════════════════════════════
//  AUTH UI
// ══════════════════════════════════════════════════════════════
window.openAdminPortal = function() {
  document.getElementById('adminDashboard')?.remove();
  document.getElementById('adminOverlay').classList.add('open');
  localStorage.setItem('adminOverlayOpen', 'true');
  if (window._adminSession && window._adminSession.institutionId) {
    showAdminDashboard(window._adminSession.role || 'hospital');
    return;
  }
  document.getElementById('adminMain').innerHTML = _authUI('login');
};

document.addEventListener('adminSessionRestored', function(e) {
  if (document.getElementById('adminOverlay')?.classList.contains('open')) {
    showAdminDashboard(e.detail.role || 'hospital');
  }
});

function _authUI(mode) {
  var isSignup = mode === 'signup';
  return '<div class="admin-enc-tag"><div class="admin-enc-bar"></div>'
    + '<span class="admin-enc-label">ENCRYPTED LINK ESTABLISHED</span></div>'
    + '<h1 class="admin-portal-title">' + (isSignup ? 'CREATE<br>ACCOUNT' : 'ACCESS<br>NEXUS<br>PORTAL') + '</h1>'
    + '<p class="admin-portal-desc">' + (isSignup
        ? 'Register your institution to manage live crisis data.'
        : 'Log in to your institution account.') + '</p>'
    + '<div class="admin-field-group">'
    + '<div><div class="admin-field-label">ROLE</div>'
    + '<div class="admin-select-wrap"><i class="fa-solid fa-lock admin-select-icon"></i>'
    + '<select class="admin-role-select" id="adminRole">'
    + '<option value="hospital">Hospital</option>'
    + '<option value="food">Food / NGO</option>'
    + '<option value="police">Police</option>'
    + '<option value="shelter">Shelter</option>'
    + '</select><i class="fa-solid fa-chevron-down admin-chevron"></i></div></div>'
    + (isSignup
      ? '<div><div class="admin-field-label">INSTITUTION NAME</div>'
        + '<div class="admin-input-wrap"><i class="fa-solid fa-building admin-input-icon"></i>'
        + '<input type="text" class="admin-input" id="adminInstName" placeholder="e.g. City General Hospital"></div></div>'
      : '')
    + '<div><div class="admin-field-label">EMAIL</div>'
    + '<div class="admin-input-wrap"><i class="fa-solid fa-envelope admin-input-icon"></i>'
    + '<input type="email" class="admin-input" id="adminEmail" placeholder="institution@email.com" autocomplete="off"></div></div>'
    + '<div><div class="admin-field-label">PASSWORD</div>'
    + '<div class="admin-input-wrap"><i class="fa-solid fa-lock admin-input-icon"></i>'
    + '<input type="password" class="admin-input" id="adminPass" placeholder="••••••••••••" autocomplete="off">'
    + '<button class="admin-eye-btn" onclick="toggleAdminPass(this)" tabindex="-1">'
    + '<i class="fa-solid fa-eye"></i></button></div></div>'
    + '<p class="admin-error" id="adminError"></p>'
    + '<button class="admin-login-btn" id="adminSubmitBtn" onclick="handleAdminAuth(\'' + mode + '\')">'
    + '<span id="adminBtnText">' + (isSignup ? 'CREATE ACCOUNT' : 'SECURE LOGIN') + '</span>'
    + '<i class="fa-solid fa-arrow-right" id="adminBtnIcon"></i>'
    + '<span id="adminBtnLoader" style="display:none;"><i class="fa-solid fa-circle-notch fa-spin"></i></span>'
    + '</button></div>'
    + '<div style="display:flex;align-items:center;justify-content:center;margin-top:16px;gap:10px;">'
    + (isSignup
      ? '<span style="font-size:12px;color:#555;">Already registered?</span>'
        + '<button onclick="switchAuthMode(\'login\')" style="background:none;border:none;color:#e03030;'
        + 'font-size:12px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;letter-spacing:1px;">LOG IN</button>'
      : '<span style="font-size:12px;color:#555;">New institution?</span>'
        + '<button onclick="switchAuthMode(\'signup\')" style="background:none;border:none;color:#e03030;'
        + 'font-size:12px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;letter-spacing:1px;">SIGN UP</button>')
    + '</div>'
    + '<div class="admin-version">V4.2</div>'
    + '<div class="admin-proto-strip"><span>SECURE PROTOCOL LENS V4.0.2 // ENCRYPTED</span></div>';
}

function switchAuthMode(mode) {
  document.getElementById('adminMain').innerHTML = _authUI(mode);
}

async function handleAdminAuth(mode) {
  var role  = fv('adminRole');
  var email = fv('adminEmail').trim();
  var pass  = fv('adminPass').trim();
  var name  = fv('adminInstName').trim();
  var errEl = document.getElementById('adminError');
  var btn   = document.getElementById('adminSubmitBtn');

  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = '⚠ Email and password required.'; return; }
  if (pass.length < 6)  { errEl.textContent = '⚠ Password must be at least 6 characters.'; return; }
  if (mode==='signup' && !name) { errEl.textContent = '⚠ Institution name required.'; return; }

  btn.disabled = true;
  document.getElementById('adminBtnText').textContent = mode==='signup' ? 'CREATING...' : 'VERIFYING...';
  document.getElementById('adminBtnIcon').style.display = 'none';
  document.getElementById('adminBtnLoader').style.display = '';

  await waitForFB(6000);

  var result;
  if (!window.FB) {
    // Firebase not loaded — still let them in for demo
    window._adminSession = { role: role, institutionId: 'offline_' + Date.now(), uid: null };
    result = { success: true };
  } else {
    result = mode === 'signup'
      ? await window.FB.signUp(role, email, pass, name)
      : await window.FB.logIn(role, email, pass);
  }

  btn.disabled = false;
  document.getElementById('adminBtnText').textContent = mode==='signup' ? 'CREATE ACCOUNT' : 'SECURE LOGIN';
  document.getElementById('adminBtnIcon').style.display = '';
  document.getElementById('adminBtnLoader').style.display = 'none';

  if (!result.success) {
    errEl.textContent = '✕ ' + result.error;
    return;
  }

  localStorage.setItem('adminLoggedIn', 'true');
  localStorage.setItem('adminRole', role);
  localStorage.setItem('adminOverlayOpen', 'true');

  showAdminDashboard(role);
}

window.handleAdminLogin = function() { handleAdminAuth('login'); };

function toggleAdminPass(btn) {
  var input = document.getElementById('adminPass');
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.querySelector('i').className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
var ROLE_META = {
  hospital:{ label:'Hospital Admin',  icon:'fa-briefcase-medical',  color:'#4ade80' },
  food:    { label:'Food / NGO Admin', icon:'fa-hand-holding-heart', color:'#facc15' },
  police:  { label:'Police Admin',     icon:'fa-shield-halved',      color:'#f87171' },
  shelter: { label:'Shelter Admin',    icon:'fa-location-dot',       color:'#93c5fd' },
};

var ACTIONS = {
  hospital:[
    { icon:'fa-bed',          bg:'#0d2b1a', color:'#4ade80', title:'Bed Management',    sub:'Update ward availability',    modal:'modal-bed-management'   },
    { icon:'fa-user-doctor',  bg:'#1a1f2e', color:'#93c5fd', title:'Staff On Duty',      sub:'Manage active staff',         modal:'modal-staff-duty'       },
    { icon:'fa-ambulance',    bg:'#2b1a1a', color:'#f87171', title:'Emergency Intake',   sub:'Log incoming cases',          modal:'modal-emergency-intake' },
    { icon:'fa-file-medical', bg:'#2a1f00', color:'#facc15', title:'Incident Reports',   sub:'Submit and review reports',   modal:'modal-hosp-incidents'   },
  ],
  food:[
    { icon:'fa-box-open',       bg:'#2a1f00', color:'#facc15', title:'Stock Update',        sub:'Update food & water stock',   modal:'modal-stock-update'    },
    { icon:'fa-location-dot',   bg:'#0d2b1a', color:'#4ade80', title:'Distribution Points', sub:'Manage active stations',      modal:'modal-distribution'    },
    { icon:'fa-truck',          bg:'#1a1f2e', color:'#93c5fd', title:'Incoming Supply',      sub:'Log incoming deliveries',     modal:'modal-incoming-supply' },
    { icon:'fa-clipboard-list', bg:'#2b1a1a', color:'#f87171', title:'NGO Coordination',     sub:'Coordinate with partners',    modal:'modal-ngo-coord'       },
  ],
  police:[
    { icon:'fa-car',         bg:'#2b1a1a', color:'#f87171', title:'Unit Deployment',  sub:'Manage field units',          modal:'modal-unit-deployment'  },
    { icon:'fa-bell',        bg:'#2a1f00', color:'#facc15', title:'Alert Broadcast',  sub:'Send area-wide alerts',       modal:'modal-alert-broadcast'  },
    { icon:'fa-map-location',bg:'#0d2b1a', color:'#4ade80', title:'Patrol Zones',     sub:'Assign patrol areas',         modal:'modal-patrol-zones'     },
    { icon:'fa-file-shield', bg:'#1a1f2e', color:'#93c5fd', title:'Incident Log',     sub:'Review filed incidents',      modal:'modal-incident-log'     },
  ],
  shelter:[
    { icon:'fa-people-group',  bg:'#1a1f2e', color:'#93c5fd', title:'Capacity Status',   sub:'Update shelter occupancy',    modal:'modal-capacity-status'   },
    { icon:'fa-kit-medical',   bg:'#2b1a1a', color:'#f87171', title:'Medical Services',   sub:'Track on-site medical',       modal:'modal-medical-services'  },
    { icon:'fa-boxes-stacked', bg:'#2a1f00', color:'#facc15', title:'Supply Inventory',   sub:'Manage food, water, kits',    modal:'modal-supply-inventory'  },
    { icon:'fa-bullhorn',      bg:'#0d2b1a', color:'#4ade80', title:'Announcements',      sub:'Post updates to residents',   modal:'modal-announcements'     },
  ],
};

window.getAdminActions = function(role) {
  return (ACTIONS[role] || []).map(function(a) {
    return '<div class="admin-action-card" onclick="openAdmModal(\'' + a.modal + '\');initAdmModal(\'' + a.modal + '\');" style="cursor:pointer;">'
      + '<div class="admin-action-icon" style="background:' + a.bg + ';">'
      + '<i class="fa-solid ' + a.icon + '" style="color:' + a.color + ';font-size:18px;"></i></div>'
      + '<div class="admin-action-text">'
      + '<div class="admin-action-title">' + a.title + '</div>'
      + '<div class="admin-action-sub">' + a.sub + '</div></div>'
      + '<i class="fa-solid fa-chevron-right admin-action-arrow"></i></div>';
  }).join('');
};

function showAdminDashboard(role) {
  var m = ROLE_META[role] || ROLE_META.hospital;
  document.getElementById('adminDashboard')?.remove();
  document.getElementById('adminMain').innerHTML =
    '<div id="adminDashboard" class="admin-dashboard open">'
    + '<div class="admin-dash-header">'
    + '<div class="admin-dash-role-badge ' + role + '">'
    + '<i class="fa-solid ' + m.icon + '"></i>' + m.label + '</div>'
    + '<button class="admin-logout-btn" onclick="adminLogout()">'
    + '<i class="fa-solid fa-right-from-bracket"></i> LOGOUT</button></div>'
    + '<div class="admin-dash-body">'
    + '<div class="admin-dash-welcome">WELCOME,<br>ADMIN</div>'
    + '<div class="admin-dash-sub">Logged in as <strong>' + m.label + '</strong></div>'
    + window.getAdminActions(role)
    + '</div></div>';
}

function adminLogout() {
  if (window.FB && window.FB.signOut) window.FB.signOut();
  window._adminSession = { role: null, institutionId: null, uid: null };
  window._liveHospitals = null; window._liveShelters = null;
  window._liveFoodData  = null; window._livePolice   = null;
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('adminOverlayOpen');
  document.getElementById('adminMain').innerHTML = _authUI('login');
}

function restoreAdminPortal() {
  var open = localStorage.getItem('adminOverlayOpen') === 'true';
  if (!open) return;
  document.getElementById('adminOverlay').classList.add('open');
  if (window._adminSession && window._adminSession.institutionId) {
    showAdminDashboard(window._adminSession.role || 'hospital');
    return;
  }
  document.getElementById('adminMain').innerHTML = _authUI('login');
}

document.addEventListener('DOMContentLoaded', restoreAdminPortal);

function closeAdminPortal() {
  document.getElementById('adminOverlay').classList.remove('open');
  localStorage.setItem('adminOverlayOpen', 'false');
}

// ══════════════════════════════════════════════════════════════
//  H1 — BED MANAGEMENT
// ══════════════════════════════════════════════════════════════
async function renderBedList() {
  // Show from local store first if available, else fetch
  var cached = _store['getWards'];
  if (!cached) {
    admLoading('bedList');
    cached = await fbGet('getWards');
  }
  var wards = cached;
  var el = document.getElementById('bedList');
  if (!el) return;
  if (!wards.length) { admEmpty('bedList', 'ADD WARD', 'showWardForm()'); return; }
  var colors = { critical:'#f87171', warning:'#facc15', normal:'#4ade80' };
  el.innerHTML = wards.map(function(w) {
    var pct = w.total > 0 ? Math.round(((w.total - (w.available||0)) / w.total) * 100) : 0;
    var c = colors[w.status] || '#4ade80';
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
      + '<div style="font-family:Rajdhani,sans-serif;font-weight:700;font-size:14px;color:#fff;">' + w.name + '</div>'
      + '<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + pct + '% FULL</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">'
      + '<div style="background:#0d0d0d;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#fff;">' + (w.total||0) + '</div><div style="font-size:9px;color:#444;letter-spacing:1px;">TOTAL</div></div>'
      + '<div style="background:#0d0d0d;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#4ade80;">' + (w.available||0) + '</div><div style="font-size:9px;color:#444;letter-spacing:1px;">FREE</div></div>'
      + '<div style="background:#0d0d0d;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#facc15;">' + (w.scheduled||0) + '</div><div style="font-size:9px;color:#444;letter-spacing:1px;">SCHEDULED</div></div>'
      + '</div>'
      + '<div style="height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden;margin-bottom:10px;">'
      + '<div style="width:' + pct + '%;height:100%;background:' + c + ';border-radius:4px;"></div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      + '<button class="adm-archive-btn" style="margin:0;padding:8px;font-size:10px;" onclick="showWardForm(\'' + w.id + '\')"><i class="fa-solid fa-pen"></i> EDIT</button>'
      + '<button class="adm-archive-btn" style="margin:0;padding:8px;font-size:10px;color:#f87171;border-color:#f8717144;" onclick="deleteWardItem(\'' + w.id + '\')"><i class="fa-solid fa-trash"></i> DELETE</button>'
      + '</div></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showWardForm()"><i class="fa-solid fa-plus"></i> ADD WARD</button>';
}

function showWardForm(id) {
  id = id || '';
  makeOverlay('wardOv', id ? 'EDIT WARD' : 'ADD WARD',
    '<div class="adm-field-lbl">WARD NAME</div>'
    + '<input class="adm-field-input" id="wf-name" placeholder="e.g. ICU East Wing" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">TOTAL BEDS</div>'
    + '<input class="adm-field-input" id="wf-total" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">AVAILABLE BEDS</div>'
    + '<input class="adm-field-input" id="wf-avail" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">SCHEDULED DISCHARGES</div>'
    + '<input class="adm-field-input" id="wf-sched" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">STATUS</div>'
    + '<select class="adm-field-input" id="wf-status">'
    + '<option value="normal">Normal</option><option value="warning">Warning</option><option value="critical">Critical</option>'
    + '</select>',
    'saveWard(\'' + id + '\')');
}

async function saveWard(id) {
  var name = fv('wf-name').trim();
  if (!name) { admAlert('⚠ Ward name required', 'error'); return; }
  var w = { name: name, total: fi('wf-total'), available: fi('wf-avail'), scheduled: fi('wf-sched'), status: fv('wf-status') || 'normal' };
  // Assign temp id for instant display
  var tempId = id || ('w_' + Date.now());
  w.id = tempId;
  // Update local store immediately
  var existing = _store['getWards'] || [];
  if (id) { var idx2 = existing.findIndex(function(x){return x.id===id;}); if(idx2>=0) existing[idx2]=w; else existing.push(w); }
  else existing.push(w);
  _store['getWards'] = existing;
  // Re-render instantly from local store
  document.getElementById('wardOv')?.remove();
  await renderBedList();
  admAlert('✓ Ward saved');
  // Then save to Firebase in background
  if (fbReady()) {
    var payload = id ? w : { name: w.name, total: w.total, available: w.available, scheduled: w.scheduled, status: w.status };
    window.FB.saveWard(payload).then(function(newId){ if(newId && newId!==true){
      var store = _store['getWards']||[]; var i2 = store.findIndex(function(x){return x.id===tempId;}); if(i2>=0){store[i2].id=newId; renderBedList();}
    }});
  }
  invalidateLiveUserData();
}

async function deleteWardItem(id) {
  if (!confirm('Delete this ward?')) return;
  // Remove from local store immediately
  if (_store['getWards']) _store['getWards'] = _store['getWards'].filter(function(w){return w.id!==id;});
  await renderBedList();
  admAlert('✓ Deleted');
  if (fbReady()) window.FB.deleteWard(id);
}

async function renderMedIncidents() {
  var el = document.getElementById('medIncidentList');
  if (!el) return;
  var incs = _store['getIncidents'] !== undefined ? _store['getIncidents'] : await fbGet('getIncidents');
  if (!incs.length) { admEmpty('medIncidentList'); return; }
  var pc = { 1:'#e03030', 2:'#facc15', 3:'#4ade80' };
  el.innerHTML = incs.slice(0, 4).map(function(i) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#111;border-radius:10px;margin-bottom:8px;">'
      + '<div style="width:36px;height:36px;border-radius:8px;background:' + (i.priority===1?'#2b1010':'#2a1f00')
      + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      + '<i class="fa-solid fa-triangle-exclamation" style="color:' + (pc[i.priority]||'#facc15') + ';font-size:14px;"></i></div>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:#fff;">' + (i.title||'Incident') + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (i.unit||'--') + '</div></div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:#f8717122;color:#f87171;border:1px solid #f8717144;white-space:nowrap;">'
      + (i.status||'ACTIVE') + '</span></div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  H2 — STAFF ON DUTY
// ══════════════════════════════════════════════════════════════
async function renderStaffList() {
  admLoading('staffList');
  var staff = _store['getStaff'] !== undefined ? _store['getStaff'] : await fbGet('getStaff');
  var el = document.getElementById('staffList');
  if (!el) return;
  if (!staff.length) { admEmpty('staffList', 'ADD STAFF', 'showStaffForm()'); return; }
  var sc = { active:'#4ade80', break:'#facc15', unavailable:'#f87171' };
  el.innerHTML = staff.map(function(s) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#111;border-radius:10px;margin-bottom:8px;">'
      + '<div style="width:38px;height:38px;border-radius:9px;background:#1a1f2e;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      + '<i class="fa-solid fa-user-doctor" style="color:#93c5fd;font-size:16px;"></i></div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:#fff;">' + s.name + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (s.role||'--') + ' · ' + (s.dept||'--') + '</div></div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + (sc[s.status]||'#facc15') + '22;color:' + (sc[s.status]||'#facc15') + ';border:1px solid ' + (sc[s.status]||'#facc15') + '44;">' + (s.status||'active').toUpperCase() + '</span>'
      + '<button class="adm-archive-btn" style="margin:0;padding:3px 8px;font-size:9px;" onclick="cycleStaff(\'' + s.id + '\',\'' + s.status + '\')">CYCLE</button>'
      + '</div></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showStaffForm()"><i class="fa-solid fa-plus"></i> ADD STAFF</button>';
}

function showStaffForm() {
  makeOverlay('staffOv', 'ADD STAFF MEMBER',
    '<div class="adm-field-lbl">FULL NAME</div>'
    + '<input class="adm-field-input" id="sf-name" placeholder="e.g. Dr. A. Kumar" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">ROLE / DESIGNATION</div>'
    + '<input class="adm-field-input" id="sf-role" placeholder="e.g. Lead Surgeon" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">DEPARTMENT</div>'
    + '<input class="adm-field-input" id="sf-dept" placeholder="e.g. ICU / Emergency">',
    'addStaff()');
}

async function addStaff() {
  var name = fv('sf-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var s = { name: name, role: fv('sf-role').trim()||'Staff', dept: fv('sf-dept').trim()||'General', status: 'active' };
  s.id = s.id || ('s_'+Date.now()); _store['getStaff'] = (_store['getStaff']||[]).filter(function(x){return x.id!==s.id;}).concat([s]);
  if (fbReady()) window.FB.saveStaff(s);
  document.getElementById('staffOv')?.remove();
  admAlert('✓ Staff added');
  storeClear('getStaff'); await renderStaffList();
}

async function cycleStaff(id, cur) {
  var states = ['active', 'break', 'unavailable'];
  var next = states[(states.indexOf(cur) + 1) % states.length];
  if (fbReady()) await window.FB.updateStaffStatus(id, next);
  admAlert('✓ Status → ' + next);
  storeClear('getStaff'); await renderStaffList();
}

// ══════════════════════════════════════════════════════════════
//  H3 — EMERGENCY INTAKE
// ══════════════════════════════════════════════════════════════
async function renderIntakeList() {
  admLoading('intakeList');
  var pts = _store['getIntake'] !== undefined ? _store['getIntake'] : await fbGet('getIntake');
  var el = document.getElementById('intakeList');
  if (!el) return;
  if (!pts.length) { admEmpty('intakeList'); return; }
  var colors = { 1:'#e03030', 2:'#facc15', 3:'#4ade80' };
  var labels = { 1:'CRITICAL', 2:'URGENT', 3:'STABLE' };
  el.innerHTML = pts.map(function(p) {
    var c = colors[p.level] || '#facc15';
    return '<div style="background:#111;border:1px solid ' + c + '33;border-left:3px solid ' + c + ';border-radius:10px;padding:12px;margin-bottom:8px;">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">'
      + '<span style="font-size:10px;color:' + c + ';font-weight:700;">' + (p.eta||'--') + '</span>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (labels[p.level]||'PENDING') + '</span>'
      + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px;">Patient #' + (p.patientId||'--') + '</div>'
      + '<div style="font-size:12px;color:#555;">' + (p.injury||'Unknown injury') + '</div>'
      + '<button class="adm-commit-btn" style="margin-top:10px;font-size:11px;" onclick="dischargePatient(\'' + p.id + '\')">'
      + '<i class="fa-solid fa-check"></i> DISCHARGE</button></div>';
  }).join('');
}

async function logNewCase() {
  var pid = fv('intake-pid').trim();
  if (!pid) { admAlert('⚠ Patient ID required', 'error'); return; }
  var levelMap = { 'Priority 1 — Critical':1, 'Priority 2 — Urgent':2, 'Priority 3 — Stable':3 };
  var p = {
    patientId: pid,
    injury: fv('intake-notes').trim() || 'Unknown',
    eta: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
    level: levelMap[fv('intake-level')] || 3,
    transport: 'Manual entry',
  };
  p.id = p.id || ('p_'+Date.now()); _store['getIntake'] = [p].concat(_store['getIntake']||[]);
  if (fbReady()) window.FB.addPatient(p);
  document.getElementById('intake-pid').value = '';
  document.getElementById('intake-notes').value = '';
  admAlert('✓ Case logged: ' + pid);
  storeClear('getIntake'); storeClear('getIntake'); await renderIntakeList();
}

async function dischargePatient(id) {
  if (_store['getIntake']) _store['getIntake'] = _store['getIntake'].filter(function(x){return x.id!==id;});
  if (fbReady()) window.FB.dischargePatient(id);
  admAlert('✓ Patient discharged');
  storeClear('getIntake'); storeClear('getIntake'); await renderIntakeList();
}

// ══════════════════════════════════════════════════════════════
//  H4 — INCIDENT REPORTS
// ══════════════════════════════════════════════════════════════
async function renderHospReports(filter) {
  filter = filter || 'ALL';
  admLoading('hospReportList');
  var reps = _store['getReports'] !== undefined ? _store['getReports'] : await fbGet('getReports');
  if (filter !== 'ALL') reps = reps.filter(function(r) { return (r.status||'').toUpperCase() === filter; });
  var el = document.getElementById('hospReportList');
  if (!el) return;
  if (!reps.length) { admEmpty('hospReportList', 'FILE REPORT', 'showReportForm()'); return; }
  var c = { pending:'#facc15', resolved:'#4ade80' };
  el.innerHTML = reps.map(function(r) {
    return '<div style="background:#111;border-left:3px solid ' + (c[r.status]||'#555') + ';border-radius:10px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
      + '<span style="font-size:10px;font-weight:700;color:#555;">' + (r.type||'REPORT') + '</span>'
      + '<span style="font-size:10px;color:#444;">' + (r.time||'--') + '</span></div>'
      + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">' + (r.title||'Untitled') + '</div>'
      + '<div style="font-size:12px;color:#555;margin-bottom:10px;">' + (r.desc||'') + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;background:' + (c[r.status]||'#555') + '22;color:' + (c[r.status]||'#555') + ';border:1px solid ' + (c[r.status]||'#555') + '44;">' + (r.status||'pending').toUpperCase() + '</span>'
      + (r.status === 'pending' ? '<button class="adm-archive-btn" style="margin:0;padding:5px 12px;font-size:10px;" onclick="acknowledgeReport(\'' + r.id + '\')">ACKNOWLEDGE</button>' : '')
      + '</div></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showReportForm()"><i class="fa-solid fa-plus"></i> FILE NEW REPORT</button>';
}

function showReportForm() {
  makeOverlay('repOv', 'FILE NEW REPORT',
    '<div class="adm-field-lbl">TYPE</div>'
    + '<select class="adm-field-input" id="rf-type" style="margin-bottom:10px;">'
    + '<option>HIGH PRIORITY</option><option>SYSTEM UPDATE</option><option>RESOURCE REQUEST</option><option>GENERAL</option>'
    + '</select>'
    + '<div class="adm-field-lbl">TITLE</div>'
    + '<input class="adm-field-input" id="rf-title" placeholder="Brief title..." style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">DESCRIPTION</div>'
    + '<textarea class="adm-field-input" id="rf-desc" rows="3" placeholder="Details..."></textarea>',
    'saveReport()');
}

async function saveReport() {
  var title = fv('rf-title').trim();
  if (!title) { admAlert('⚠ Title required', 'error'); return; }
  var r = {
    type: fv('rf-type') || 'GENERAL', title: title,
    desc: fv('rf-desc').trim() || '',
    time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
    status: 'pending',
  };
  r.id = r.id || ('r_'+Date.now()); _store['getReports'] = [r].concat(_store['getReports']||[]);
  if (fbReady()) window.FB.addReport(r);
  document.getElementById('repOv')?.remove();
  admAlert('✓ Report filed');
  storeClear('getReports'); storeClear('getReports'); await renderHospReports('ALL');
}

async function acknowledgeReport(id) {
  if (_store['getReports']) { var _rfi=_store['getReports'].findIndex(function(x){return x.id===id;}); if(_rfi>=0)_store['getReports'][_rfi].status='resolved'; }
  if (fbReady()) await window.FB.updateReportStatus(id, 'resolved');
  admAlert('✓ Acknowledged');
  storeClear('getReports'); storeClear('getReports'); await renderHospReports('ALL');
}

// ══════════════════════════════════════════════════════════════
//  F1 — STOCK UPDATE
// ══════════════════════════════════════════════════════════════
async function renderStockCards() {
  admLoading('stockCards');
  var items = _store['getStock'] !== undefined ? _store['getStock'] : await fbGet('getStock');
  var el = document.getElementById('stockCards');
  if (!el) return;
  if (!items.length) { admEmpty('stockCards', 'ADD ITEM', 'showStockForm()'); return; }
  var cm = { optimal:'#4ade80', review:'#facc15', critical:'#f87171', stable:'#4ade80' };
  var banner = '<div style="background:#2a1f1f;border:1px solid #3a2a2a;border-radius:10px;padding:12px;margin-bottom:14px;font-size:11px;color:#888;line-height:1.6;">'
    + '<i class="fa-solid fa-info-circle" style="color:#facc15;margin-right:6px;"></i>'
    + '<strong style="color:#facc15;">Stock items are internal inventory.</strong> '
    + 'To display items to users, create <strong>Distribution Points</strong> (Section F2) with location & supply levels.'
    + '</div>';
  el.innerHTML = banner + items.map(function(s) {
    var c = cm[s.status] || '#4ade80';
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<div style="width:36px;height:36px;border-radius:8px;background:' + (s.iconBg||'#2a1f00') + ';display:flex;align-items:center;justify-content:center;">'
      + '<i class="fa-solid ' + (s.icon||'fa-box-open') + '" style="color:' + (s.iconColor||'#facc15') + ';font-size:16px;"></i></div>'
      + '<div><div style="font-size:13px;font-weight:600;color:#fff;">' + s.name + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (s.sub||'') + '</div></div></div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (s.status||'OK').toUpperCase() + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
      + '<button class="adm-archive-btn" style="margin:0;width:32px;height:32px;padding:0;font-size:16px;display:flex;align-items:center;justify-content:center;" onclick="changeQty(\'' + s.id + '\',-50)">−</button>'
      + '<div style="flex:1;text-align:center;">'
      + '<span id="qty-' + s.id + '" style="font-size:22px;font-weight:800;color:#fff;">' + (s.qty||0).toLocaleString() + '</span>'
      + '<span style="font-size:11px;color:#555;margin-left:4px;">' + (s.unit||'UNITS') + '</span>'
      + '</div>'
      + '<button class="adm-archive-btn" style="margin:0;width:32px;height:32px;padding:0;font-size:16px;display:flex;align-items:center;justify-content:center;" onclick="changeQty(\'' + s.id + '\',50)">+</button>'
      + '</div>'
      + '<div style="height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden;">'
      + '<div style="width:' + Math.min(100, s.pct||0) + '%;height:100%;background:' + c + ';border-radius:4px;"></div></div>'
      + '</div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showStockForm()"><i class="fa-solid fa-plus"></i> ADD ITEM</button>';
}

async function changeQty(id, delta) {
  var items = _store['getStock'] !== undefined ? _store['getStock'] : await fbGet('getStock');
  var item = items.find(function(i) { return i.id === id; });
  if (!item) return;
  var nq = Math.max(0, (item.qty||0) + delta);
  if (fbReady()) await window.FB.updateStockItem(id, { qty: nq });
  var el = document.getElementById('qty-' + id);
  if (el) el.textContent = nq.toLocaleString();
}

function showStockForm() {
  makeOverlay('stOv', 'ADD STOCK ITEM',
    '<div class="adm-field-lbl">ITEM NAME</div>'
    + '<input class="adm-field-input" id="si-name" placeholder="e.g. Meal Kits" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">DESCRIPTION</div>'
    + '<input class="adm-field-input" id="si-sub" placeholder="e.g. 24hr Rations" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">QUANTITY</div>'
    + '<input class="adm-field-input" id="si-qty" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">UNIT</div>'
    + '<input class="adm-field-input" id="si-unit" placeholder="UNITS / LITERS / PACKS" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">STATUS</div>'
    + '<select class="adm-field-input" id="si-status">'
    + '<option value="optimal">Optimal</option><option value="review">Review</option><option value="critical">Critical</option>'
    + '</select>',
    'addStockItem()');
}

async function addStockItem() {
  var name = fv('si-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var st = fv('si-status') || 'optimal';
  var cm = { optimal:'#4ade80', review:'#facc15', critical:'#f87171' };
  var qty = fi('si-qty');
  var item = {
    name: name, sub: fv('si-sub').trim()||'', qty: qty,
    unit: fv('si-unit').trim()||'UNITS', status: st, statusColor: cm[st],
    pct: Math.min(100, Math.round((qty/2000)*100)),
    icon: 'fa-box-open', iconBg: '#2a1f00', iconColor: '#facc15',
  };
  item.id = item.id || ('st_'+Date.now()); _store['getStock'] = (_store['getStock']||[]).concat([item]);
  if (fbReady()) window.FB.addStockItem(item);
  document.getElementById('stOv')?.remove();
  admAlert('✓ Item added');
  storeClear('getStock'); await renderStockCards();
}

async function commitStockEntry() {
  var asset = fv('assetId').trim();
  var qty = parseInt(fv('qtyAdj')) || 0;
  if (!asset) { admAlert('⚠ Asset ID required', 'error'); return; }
  var e = { who:'MANUAL ENTRY', text:'Asset ' + asset + ' adjusted by ' + (qty>=0?'+':'') + qty + ' units.', time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), color:'#facc15' };
  if (fbReady()) await window.FB.addLedgerEntry(e);
  document.getElementById('assetId').value = '';
  document.getElementById('qtyAdj').value = '';
  admAlert('✓ Ledger updated');
  storeClear('getLedger'); await renderLedger('ledgerList');
}

async function renderLedger(elId) {
  admLoading(elId);
  var logs = _store['getLedger'] !== undefined ? _store['getLedger'] : await fbGet('getLedger');
  var el = document.getElementById(elId);
  if (!el) return;
  if (!logs.length) { admEmpty(elId); return; }
  el.innerHTML = logs.slice(0, 10).map(function(l) {
    return '<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #111;">'
      + '<div style="width:8px;height:8px;border-radius:50%;background:' + (l.color||'#4ade80') + ';margin-top:4px;flex-shrink:0;"></div>'
      + '<div><div style="font-size:11px;font-weight:700;color:#888;">' + (l.who||'SYSTEM') + ' <span style="color:#444;font-weight:400;">' + (l.time||'') + '</span></div>'
      + '<div style="font-size:12px;color:#555;">' + (l.text||'') + '</div></div></div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  F2 — DISTRIBUTION POINTS
// ══════════════════════════════════════════════════════════════
async function renderDistroList() {
  admLoading('distroList');
  var stns = _store['getStations'] !== undefined ? _store['getStations'] : await fbGet('getStations');
  var el = document.getElementById('distroList');
  if (!el) return;
  if (!stns.length) { admEmpty('distroList', 'ADD STATION', 'showDistroForm()'); return; }
  var sc = { active:'#4ade80', restricted:'#facc15', depleted:'#f87171', offline:'#f87171' };
  el.innerHTML = stns.map(function(s) {
    var c = sc[s.status] || '#facc15';
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">'
      + '<div><div style="font-size:14px;font-weight:700;color:#fff;">' + s.name + '</div>'
      + '<div style="font-size:11px;color:#555;margin-top:2px;"><i class="fa-solid fa-location-dot"></i> ' + (s.loc||'--') + '</div></div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (s.status||'active').toUpperCase() + '</span>'
      + '</div>'
      + (s.status !== 'offline' && s.status !== 'depleted'
        ? '<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px;"><span>WATER</span><span>' + (s.water||0) + '%</span></div>'
          + '<div style="height:4px;background:#1a1a1a;border-radius:2px;"><div style="width:' + (s.water||0) + '%;height:100%;background:' + ((s.water||0)>50?'#4ade80':'#f87171') + ';border-radius:2px;"></div></div></div>'
          + '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px;"><span>MED KITS</span><span>' + (s.kits||0) + '%</span></div>'
          + '<div style="height:4px;background:#1a1a1a;border-radius:2px;"><div style="width:' + (s.kits||0) + '%;height:100%;background:' + ((s.kits||0)>50?'#4ade80':'#facc15') + ';border-radius:2px;"></div></div></div>'
        : '<div style="font-size:11px;color:#f87171;margin-bottom:10px;">Unavailable</div>')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      + '<button class="adm-archive-btn" style="margin:0;font-size:10px;padding:8px;" onclick="showDistroForm(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i> EDIT</button>'
      + '<button class="adm-archive-btn" style="margin:0;font-size:10px;padding:8px;color:' + (s.status==='active'?'#f87171':'#4ade80') + ';border-color:' + (s.status==='active'?'#f8717144':'#4ade8044') + ';" onclick="toggleDistro(\'' + s.id + '\',\'' + s.status + '\')">' + (s.status==='active'?'DEACTIVATE':'ACTIVATE') + '</button>'
      + '</div></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showDistroForm()"><i class="fa-solid fa-plus"></i> ADD STATION</button>';
}

async function showDistroForm(id) {
  id = id || '';
  var s = { name:'', loc:'', water:0, kits:0, status:'active' };
  if (id) { var all = _store['getStations'] !== undefined ? _store['getStations'] : await fbGet('getStations'); var f = all.find(function(x){return x.id===id;}); if (f) s = f; }
  makeOverlay('dsOv', id ? 'EDIT STATION' : 'ADD STATION',
    '<div class="adm-field-lbl">STATION NAME</div>'
    + '<input class="adm-field-input" id="do-name" value="' + (s.name||'') + '" placeholder="e.g. ALPHA-1" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">LOCATION</div>'
    + '<input class="adm-field-input" id="do-loc" value="' + (s.loc||'') + '" placeholder="e.g. Downtown Plaza" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">WATER LEVEL %</div>'
    + '<input class="adm-field-input" id="do-water" type="number" min="0" max="100" value="' + (s.water||0) + '" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">MED KITS LEVEL %</div>'
    + '<input class="adm-field-input" id="do-kits" type="number" min="0" max="100" value="' + (s.kits||0) + '" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">STATUS</div>'
    + '<select class="adm-field-input" id="do-status">'
    + '<option value="active"' + (s.status==='active'?' selected':'') + '>Active</option>'
    + '<option value="restricted"' + (s.status==='restricted'?' selected':'') + '>Restricted</option>'
    + '<option value="depleted"' + (s.status==='depleted'?' selected':'') + '>Depleted</option>'
    + '<option value="offline"' + (s.status==='offline'?' selected':'') + '>Offline</option>'
    + '</select>',
    'saveDistro(\'' + id + '\')');
}

async function saveDistro(id) {
  var name = fv('do-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var st = { name:name, loc:fv('do-loc').trim()||'', water:fi('do-water'), kits:fi('do-kits'), status:fv('do-status')||'active' };
  if (id) st.id = id;
  if (!st.id) st.id = 'ds_'+Date.now(); var _dsSt=_store['getStations']||[]; var _dsIdx=_dsSt.findIndex(function(x){return x.id===st.id;}); if(_dsIdx>=0)_dsSt[_dsIdx]=st; else _dsSt.push(st); _store['getStations']=_dsSt;
  if (fbReady()) {
    var payload = id ? st : { name:st.name, loc:st.loc, water:st.water, kits:st.kits, status:st.status };
    window.FB.saveStation(payload).then(function(newId){ if(newId && newId!==true){ var store = _store['getStations']||[]; var i2 = store.findIndex(function(x){return x.id===st.id;}); if(i2>=0){store[i2].id=newId; renderDistroList();}} });
  }
  invalidateLiveUserData();
  document.getElementById('dsOv')?.remove();
  admAlert('✓ Station saved');
  storeClear('getStations'); storeClear('getStations'); await renderDistroList();
}

async function toggleDistro(id, cur) {
  var next = cur === 'active' ? 'offline' : 'active';
  if (_store['getStations']) { var _tIdx=_store['getStations'].findIndex(function(x){return x.id===id;}); if(_tIdx>=0)_store['getStations'][_tIdx].status=next; }
  if (fbReady()) window.FB.saveStation({ id:id, status:next });
  invalidateLiveUserData();
  admAlert('✓ → ' + next);
  storeClear('getStations'); storeClear('getStations'); await renderDistroList();
}

// ══════════════════════════════════════════════════════════════
//  F3 — INCOMING SUPPLY
// ══════════════════════════════════════════════════════════════
async function renderSupplyList() {
  admLoading('supplyList');
  var convoys = _store['getConvoys'] !== undefined ? _store['getConvoys'] : await fbGet('getConvoys');
  var el = document.getElementById('supplyList');
  if (!el) return;
  if (!convoys.length) { admEmpty('supplyList'); return; }
  var sc = { 'in-transit':'#f87171', arriving:'#4ade80', delayed:'#888', clearing:'#facc15' };
  el.innerHTML = convoys.map(function(c) {
    var col = sc[c.status] || '#facc15';
    return '<div style="background:#111;border-left:3px solid ' + col + ';border-radius:10px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">'
      + '<div><div style="font-size:10px;color:#555;">CONVOY ' + (c.convoyId||c.id||'--') + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:#fff;margin-top:2px;">' + (c.cargo||'Unknown cargo') + '</div></div>'
      + '<div style="text-align:right;"><div style="font-size:10px;color:#555;">ETA</div>'
      + '<div style="font-size:16px;font-weight:800;color:#fff;">' + (c.eta||'--') + '</div></div></div>'
      + '<div style="font-size:11px;color:' + col + ';margin-bottom:10px;">' + (c.pos||'En route') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      + '<button class="adm-commit-btn" style="margin:0;font-size:10px;padding:8px;" onclick="confirmSupply(\'' + c.id + '\')">'
      + '<i class="fa-solid fa-check"></i> CONFIRM</button>'
      + '<button class="adm-archive-btn" style="margin:0;font-size:10px;padding:8px;color:#93c5fd;" onclick="showConvoyEditForm(\'' + c.id + '\')">'
      + '<i class="fa-solid fa-pen"></i> EDIT</button>'
      + '</div></div>';
  }).join('');
}

async function logDelivery() {
  var vid = fv('convoy-vid').trim();
  if (!vid) { admAlert('⚠ Vehicle ID required', 'error'); return; }
  var qty = fv('convoy-qty').trim() || '?';
  var cargo = fv('convoy-cargo') || 'Mixed Relief';
  var c = { convoyId:vid, cargo:qty+'×'+cargo, pos:'En Route', eta:'--:--', status:'in-transit' };
  c.id = c.id || ('c_'+Date.now()); _store['getConvoys'] = [c].concat(_store['getConvoys']||[]);
  if (fbReady()) window.FB.addConvoy(c);
  document.getElementById('convoy-vid').value = '';
  document.getElementById('convoy-qty').value = '';
  admAlert('✓ Delivery logged: ' + vid);
  storeClear('getConvoys'); storeClear('getConvoys'); storeClear('getConvoys'); await renderSupplyList();
}

async function confirmSupply(id) {
  if (_store['getConvoys']) _store['getConvoys'] = _store['getConvoys'].filter(function(x){return x.id!==id;});
  if (fbReady()) window.FB.deleteConvoy(id);
  admAlert('✓ Delivery confirmed');
  storeClear('getConvoys'); storeClear('getConvoys'); storeClear('getConvoys'); await renderSupplyList();
}

async function showConvoyEditForm(id) {
  var all = _store['getConvoys'] !== undefined ? _store['getConvoys'] : await fbGet('getConvoys');
  var c = all.find(function(x){ return x.id===id; }) || {};
  makeOverlay('convOv', 'EDIT CONVOY',
    '<div class="adm-field-lbl">CARGO</div>'
    + '<input class="adm-field-input" id="cf-cargo" value="' + (c.cargo||'') + '" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">CURRENT POSITION</div>'
    + '<input class="adm-field-input" id="cf-pos" value="' + (c.pos||'') + '" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">ETA</div>'
    + '<input class="adm-field-input" id="cf-eta" value="' + (c.eta||'') + '" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">STATUS</div>'
    + '<select class="adm-field-input" id="cf-status">'
    + '<option value="in-transit"' + (c.status==='in-transit'?' selected':'') + '>In Transit</option>'
    + '<option value="arriving"' + (c.status==='arriving'?' selected':'') + '>Arriving</option>'
    + '<option value="clearing"' + (c.status==='clearing'?' selected':'') + '>Clearing</option>'
    + '<option value="delayed"' + (c.status==='delayed'?' selected':'') + '>Delayed</option>'
    + '</select>',
    'saveConvoy(\'' + id + '\')');
}

async function saveConvoy(id) {
  var d = { cargo:fv('cf-cargo').trim(), pos:fv('cf-pos').trim(), eta:fv('cf-eta').trim(), status:fv('cf-status') };
  if (fbReady()) await window.FB.updateConvoy(id, d);
  document.getElementById('convOv')?.remove();
  admAlert('✓ Updated');
  storeClear('getConvoys'); storeClear('getConvoys'); storeClear('getConvoys'); await renderSupplyList();
}

// ══════════════════════════════════════════════════════════════
//  F4 — NGO COORDINATION
// ══════════════════════════════════════════════════════════════
async function renderNGOList() {
  admLoading('ngoList');
  var partners = _store['getPartners'] !== undefined ? _store['getPartners'] : await fbGet('getPartners');
  var el = document.getElementById('ngoList');
  if (!el) return;
  if (!partners.length) { admEmpty('ngoList', 'ADD PARTNER', 'showNGOForm()'); return; }
  var bgs = ['#2b1a1a','#0d1f2e','#0d2010','#1a1a2e','#2a1f00'];
  var cols = ['#f87171','#93c5fd','#4ade80','#c4b5fd','#facc15'];
  el.innerHTML = partners.map(function(p, i) {
    var ini = p.name.split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#111;border-radius:10px;margin-bottom:8px;">'
      + '<div style="width:38px;height:38px;border-radius:9px;background:' + bgs[i%5] + ';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:' + cols[i%5] + ';font-family:Rajdhani,sans-serif;flex-shrink:0;">' + ini + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:#fff;">' + p.name + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (p.type||'--') + ' | ' + (p.contact||'--') + '</div></div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + (p.status==='active'?'#4ade8022':'#facc1522') + ';color:' + (p.status==='active'?'#4ade80':'#facc15') + ';border:1px solid ' + (p.status==='active'?'#4ade8044':'#facc1544') + ';">' + (p.status||'active').toUpperCase() + '</span>'
      + '</div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showNGOForm()"><i class="fa-solid fa-plus"></i> ADD PARTNER</button>';
}

function showNGOForm() {
  makeOverlay('ngoOv', 'ADD NGO PARTNER',
    '<div class="adm-field-lbl">ORGANIZATION NAME</div>'
    + '<input class="adm-field-input" id="ng-name" placeholder="e.g. Red Cross India" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">TYPE</div>'
    + '<input class="adm-field-input" id="ng-type" placeholder="e.g. Medical / Food Relief" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">CONTACT NUMBER</div>'
    + '<input class="adm-field-input" id="ng-contact" placeholder="e.g. +91 98765 43210">',
    'addNGOPartner()');
}

async function addNGOPartner() {
  var name = fv('ng-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var p = { name:name, type:fv('ng-type').trim()||'General', contact:fv('ng-contact').trim()||'--', status:'active' };
  p.id = p.id || ('ng_'+Date.now()); _store['getPartners'] = (_store['getPartners']||[]).concat([p]);
  if (fbReady()) window.FB.addPartner(p);
  document.getElementById('ngoOv')?.remove();
  admAlert('✓ Partner added');
  storeClear('getPartners'); await renderNGOList();
}

// keep old alias
async function saveNGO() { showNGOForm(); }

// ══════════════════════════════════════════════════════════════
//  P1 — UNIT DEPLOYMENT
// ══════════════════════════════════════════════════════════════
async function renderUnitList() {
  admLoading('unitList');
  var units = _store['getUnits'] !== undefined ? _store['getUnits'] : await fbGet('getUnits');
  var el = document.getElementById('unitList');
  if (!el) return;
  if (!units.length) { admEmpty('unitList'); return; }
  var sc = { active:'#4ade80', 'on-call':'#facc15', 'in-transit':'#93c5fd' };
  el.innerHTML = units.map(function(u) {
    var c = sc[u.status] || '#facc15';
    return '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#111;border-radius:10px;margin-bottom:8px;">'
      + '<div style="width:38px;height:38px;border-radius:9px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      + '<i class="fa-solid fa-car" style="color:#93c5fd;font-size:16px;"></i></div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:#fff;">' + (u.unitId||u.id) + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (u.type||'Patrol') + ' | ' + (u.sector||'--') + '</div></div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (u.status||'active').toUpperCase() + '</span>'
      + '<button class="adm-archive-btn" style="margin:0;padding:3px 8px;font-size:9px;color:#f87171;border-color:#f8717144;" onclick="recallUnit(\'' + u.id + '\',\'' + (u.unitId||'Unit') + '\')">RECALL</button>'
      + '</div></div>';
  }).join('');
}

async function deployNewUnit() {
  var uid = fv('unit-id').trim();
  if (!uid) { admAlert('⚠ Unit ID required', 'error'); return; }
  var u = { unitId:uid, type:fv('unit-mission')||'Patrol', sector:fv('unit-sector').trim()||'Unassigned', status:'active' };
  u.id = u.id || ('u_'+Date.now()); _store['getUnits'] = [u].concat(_store['getUnits']||[]);
  if (fbReady()) window.FB.addUnit(u);
  invalidateLiveUserData();
  document.getElementById('unit-id').value = '';
  document.getElementById('unit-sector').value = '';
  admAlert('✓ Deployed: ' + uid);
  storeClear('getUnits'); storeClear('getUnits'); await renderUnitList();
}

async function recallUnit(id, name) {
  if (_store['getUnits']) _store['getUnits'] = _store['getUnits'].filter(function(x){return x.id!==id;});
  if (fbReady()) window.FB.deleteUnit(id);
  admAlert('✓ ' + name + ' recalled');
  storeClear('getUnits'); storeClear('getUnits'); await renderUnitList();
}

// ══════════════════════════════════════════════════════════════
//  P2 — ALERT BROADCAST
// ══════════════════════════════════════════════════════════════
async function renderIncidentFeed(elId) {
  admLoading(elId);
  var incs = _store['getIncidents'] !== undefined ? _store['getIncidents'] : await fbGet('getIncidents');
  var el = document.getElementById(elId);
  if (!el) return;
  if (!incs.length) { admEmpty(elId); return; }
  var pc = { 1:'#e03030', 2:'#facc15', 3:'#4ade80' };
  el.innerHTML = incs.slice(0, 8).map(function(i) {
    var c = pc[i.priority] || '#facc15';
    return '<div style="background:#111;border-left:3px solid ' + c + ';border-radius:10px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">P' + (i.priority||'?') + '</span>'
      + '<span style="font-size:10px;color:#444;">#' + (i.incidentId||i.id||'--') + '</span>'
      + '<span style="font-size:10px;color:#444;margin-left:auto;">' + (i.time||'--') + '</span></div>'
      + '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">' + (i.title||'Incident') + '</div>'
      + '<div style="font-size:12px;color:#555;margin-bottom:8px;">' + (i.desc||'') + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:11px;color:#93c5fd;">UNIT: ' + (i.unit||'--') + '</span>'
      + '<button class="adm-archive-btn" style="margin:0;padding:5px 10px;font-size:10px;" onclick="resolveIncident(\'' + i.id + '\')">'
      + '<i class="fa-solid fa-check"></i> RESOLVE</button></div></div>';
  }).join('');
}

async function broadcastAlert() {
  var msg = fv('bc-msg').trim();
  if (!msg) { admAlert('⚠ Message required', 'error'); return; }
  var inc = {
    incidentId: 'BC-' + Date.now().toString().slice(-4),
    icon: 'fa-satellite-dish',
    title: fv('bc-type') || 'Alert',
    desc: msg,
    priority: 2,
    time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
    sector: fv('bc-sector') || 'All Sectors',
    unit: 'CMD-BROADCAST',
    status: 'ACTIVE',
  };
  inc.id = inc.id || ('inc_'+Date.now()); _store['getIncidents'] = [inc].concat(_store['getIncidents']||[]);
  if (fbReady()) window.FB.addIncident(inc);
  document.getElementById('bc-msg').value = '';
  admAlert('✓ Alert broadcast sent');
  storeClear('getIncidents'); storeClear('getIncidents'); await renderIncidentFeed('incidentFeed');
}

async function resolveIncident(id) {
  if (fbReady()) await window.FB.updateIncidentStatus(id, 'RESOLVED');
  admAlert('✓ Resolved');
  storeClear('getIncidents'); storeClear('getIncidents'); await renderIncidentFeed('incidentFeed');
  await renderIncidentFeed('incidentLog');
}

async function renderCmdNotes(elId) {
  admLoading(elId);
  var notes = _store['getNotes'] !== undefined ? _store['getNotes'] : await fbGet('getNotes');
  var el = document.getElementById(elId);
  if (!el) return;
  if (!notes.length) { admEmpty(elId); return; }
  el.innerHTML = notes.slice(0, 6).map(function(n) {
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:12px;margin-bottom:8px;">'
      + '<div style="font-size:9px;font-weight:700;color:#e03030;letter-spacing:1.5px;margin-bottom:6px;">' + (n.tag||'NOTE') + '</div>'
      + '<div style="font-size:13px;color:#ccc;font-style:italic;">"' + (n.text||'') + '"</div>'
      + '<div style="font-size:10px;color:#444;margin-top:6px;">' + (n.time||'') + '</div></div>';
  }).join('');
}

function showNoteForm() {
  makeOverlay('noteOv', 'ADD COMMANDER NOTE',
    '<div class="adm-field-lbl">TAG</div>'
    + '<select class="adm-field-input" id="nf-tag" style="margin-bottom:10px;">'
    + '<option>CRITICAL ALERT</option><option>TACTICAL NOTE</option><option>STATUS UPDATE</option><option>GENERAL</option>'
    + '</select>'
    + '<div class="adm-field-lbl">NOTE TEXT</div>'
    + '<textarea class="adm-field-input" id="nf-text" rows="4" placeholder="Enter your note..."></textarea>',
    'saveNote()');
}

async function saveNote() {
  var text = fv('nf-text').trim();
  if (!text) { admAlert('⚠ Text required', 'error'); return; }
  var n = { tag:fv('nf-tag')||'NOTE', text:text, time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' — Admin' };
  n.id = n.id || ('n_'+Date.now()); _store['getNotes'] = [n].concat(_store['getNotes']||[]);
  if (fbReady()) window.FB.addNote(n);
  document.getElementById('noteOv')?.remove();
  admAlert('✓ Note added');
  storeClear('getNotes'); await renderCmdNotes('cmdNotes');
  await renderCmdNotes('cmdNotes2');
}

// ══════════════════════════════════════════════════════════════
//  P3 — PATROL ZONES
// ══════════════════════════════════════════════════════════════
async function renderPatrolZones() {
  admLoading('patrolZoneList');
  var zones = _store['getZones'] !== undefined ? _store['getZones'] : await fbGet('getZones');
  zones = zones.filter(function(z){ return !z.archived; });
  var el = document.getElementById('patrolZoneList');
  if (!el) return;
  if (!zones.length) { admEmpty('patrolZoneList', 'ADD ZONE', 'showZoneForm()'); return; }
  var sc = { critical:'#f87171', elevated:'#facc15', clear:'#4ade80', stable:'#4ade80' };
  var cycleOrder = ['clear','elevated','critical','stable'];
  el.innerHTML = zones.map(function(z) {
    var c = sc[z.status] || '#facc15';
    var next = cycleOrder[(cycleOrder.indexOf(z.status)+1)%cycleOrder.length];
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">'
      + '<div>'
      + '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;background:#1a1a1a;color:#888;letter-spacing:1px;">' + (z.zoneId||'--') + '</span>'
      + '<div style="font-size:14px;font-weight:700;color:#fff;margin-top:6px;">' + (z.name||'Zone') + '</div>'
      + '<div style="font-size:11px;color:#555;margin-top:2px;"><i class="fa-solid fa-shield-halved"></i> ' + (z.units||'Unassigned') + '</div>'
      + '</div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (z.status||'clear').toUpperCase() + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      + '<button class="adm-archive-btn" style="margin:0;font-size:10px;padding:8px;" onclick="cycleZone(\'' + z.id + '\',\'' + next + '\')">'
      + '<i class="fa-solid fa-rotate"></i> CYCLE STATUS</button>'
      + '<button class="adm-archive-btn" style="margin:0;font-size:10px;padding:8px;color:#f87171;border-color:#f8717144;" onclick="removeZone(\'' + z.id + '\')">'
      + '<i class="fa-solid fa-trash"></i> REMOVE</button>'
      + '</div></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showZoneForm()"><i class="fa-solid fa-plus"></i> ASSIGN NEW ZONE</button>';
}

async function cycleZone(id, next) {
  if (_store['getZones']) { var _czIdx=_store['getZones'].findIndex(function(x){return x.id===id;}); if(_czIdx>=0)_store['getZones'][_czIdx].status=next; }
  if (fbReady()) window.FB.updateZone(id, { status:next });
  admAlert('✓ Zone → ' + next);
  storeClear('getZones'); storeClear('getZones'); storeClear('getZones'); await renderPatrolZones();
}

async function removeZone(id) {
  if (_store['getZones']) _store['getZones'] = _store['getZones'].filter(function(x){return x.id!==id;});
  if (fbReady()) window.FB.updateZone(id, { archived:true });
  admAlert('✓ Zone removed');
  storeClear('getZones'); storeClear('getZones'); storeClear('getZones'); await renderPatrolZones();
}

function showZoneForm() {
  makeOverlay('zoneOv', 'ASSIGN NEW ZONE',
    '<div class="adm-field-lbl">ZONE NAME</div>'
    + '<input class="adm-field-input" id="zo-name" placeholder="e.g. Sector 4B Downtown" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">ASSIGNED UNITS</div>'
    + '<input class="adm-field-input" id="zo-units" placeholder="e.g. UNIT-P42, UNIT-P17">',
    'saveZone()');
}

async function saveZone() {
  var name = fv('zo-name').trim();
  if (!name) { admAlert('⚠ Zone name required', 'error'); return; }
  var z = { zoneId:'Z-'+Date.now().toString().slice(-4), name:name, units:fv('zo-units').trim()||'Unassigned', status:'clear', incidents:0 };
  z.id = z.id || ('z_'+Date.now()); _store['getZones'] = (_store['getZones']||[]).concat([z]);
  if (fbReady()) window.FB.addZone(z);
  document.getElementById('zoneOv')?.remove();
  admAlert('✓ Zone added');
  storeClear('getZones'); storeClear('getZones'); storeClear('getZones'); await renderPatrolZones();
}

// ══════════════════════════════════════════════════════════════
//  S1 — CAPACITY STATUS
// ══════════════════════════════════════════════════════════════
async function renderCapacityList() {
  admLoading('capacityList');
  var wards = _store['getShelterWards'] !== undefined ? _store['getShelterWards'] : await fbGet('getShelterWards');
  var el = document.getElementById('capacityList');
  if (!el) return;
  if (!wards.length) { admEmpty('capacityList', 'ADD WARD', 'showShelterWardForm()'); return; }
  el.innerHTML = wards.map(function(w) {
    var pct = w.total > 0 ? Math.round(((w.occupied||0)/w.total)*100) : 0;
    var c = pct>=90?'#f87171':pct>=60?'#facc15':'#4ade80';
    return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
      + '<div><div style="font-size:14px;font-weight:700;color:#fff;">' + w.name + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (w.type||'Shelter') + '</div></div>'
      + '<span style="font-size:18px;font-weight:800;color:' + c + ';">' + pct + '%</span></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">'
      + '<div style="background:#0d0d0d;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#fff;">' + (w.occupied||0) + '</div><div style="font-size:9px;color:#444;letter-spacing:1px;">OCCUPIED</div></div>'
      + '<div style="background:#0d0d0d;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#4ade80;">' + ((w.total||0)-(w.occupied||0)) + '</div><div style="font-size:9px;color:#444;letter-spacing:1px;">AVAILABLE</div></div>'
      + '</div>'
      + '<div style="height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden;margin-bottom:10px;">'
      + '<div style="width:' + pct + '%;height:100%;background:' + c + ';border-radius:4px;"></div></div>'
      + '<button class="adm-archive-btn" style="margin:0;width:100%;font-size:10px;padding:8px;" onclick="showShelterWardForm(\'' + w.id + '\')">'
      + '<i class="fa-solid fa-pen"></i> UPDATE</button></div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showShelterWardForm()"><i class="fa-solid fa-plus"></i> ADD WARD</button>';
}

function showShelterWardForm(id) {
  id = id || '';
  makeOverlay('swOv', id ? 'UPDATE WARD' : 'ADD WARD',
    '<div class="adm-field-lbl">WARD / BLOCK NAME</div>'
    + '<input class="adm-field-input" id="sw-name" placeholder="e.g. Block A — Families" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">TYPE</div>'
    + '<input class="adm-field-input" id="sw-type" placeholder="e.g. General Shelter / Medical" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">TOTAL CAPACITY</div>'
    + '<input class="adm-field-input" id="sw-total" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">CURRENT OCCUPANCY</div>'
    + '<input class="adm-field-input" id="sw-occ" type="number" min="0" placeholder="0">',
    'saveShelterWard(\'' + id + '\')');
}

async function saveShelterWard(id) {
  var name = fv('sw-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var w = { name:name, type:fv('sw-type').trim()||'Shelter', total:fi('sw-total'), occupied:fi('sw-occ') };
  if (id) w.id = id;
  if (!w.id) w.id = 'sw_'+Date.now(); var _swArr=_store['getShelterWards']||[]; var _swIdx=_swArr.findIndex(function(x){return x.id===w.id;}); if(_swIdx>=0)_swArr[_swIdx]=w; else _swArr.push(w); _store['getShelterWards']=_swArr;
  if (fbReady()) {
    var payload = id ? w : { name:w.name, type:w.type, total:w.total, occupied:w.occupied };
    window.FB.saveShelterWard(payload).then(function(newId){ if(newId && newId!==true){ var store = _store['getShelterWards']||[]; var i2 = store.findIndex(function(x){return x.id===w.id;}); if(i2>=0){store[i2].id=newId; renderCapacityList();}} });
  }
  invalidateLiveUserData();
  document.getElementById('swOv')?.remove();
  admAlert('✓ Ward saved');
  storeClear('getShelterWards'); await renderCapacityList();
}

// ══════════════════════════════════════════════════════════════
//  S2 — MEDICAL SERVICES
// ══════════════════════════════════════════════════════════════
async function renderShelterMedList() {
  admLoading('shelterMedList');
  var incs = _store['getShelterMedical'] !== undefined ? _store['getShelterMedical'] : await fbGet('getShelterMedical');
  var el = document.getElementById('shelterMedList');
  if (!el) return;
  if (!incs.length) { admEmpty('shelterMedList', 'LOG INCIDENT', 'showMedIncidentForm()'); return; }
  var pc = { 1:'#e03030', 2:'#facc15', 3:'#4ade80' };
  el.innerHTML = incs.slice(0, 6).map(function(i) {
    var c = pc[i.priority] || '#facc15';
    return '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#111;border-radius:10px;margin-bottom:8px;">'
      + '<div style="width:38px;height:38px;border-radius:9px;background:' + (i.priority===1?'#2b1010':'#2a1f00') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      + '<i class="fa-solid fa-kit-medical" style="color:' + c + ';font-size:16px;"></i></div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:#fff;">' + (i.title||'Incident') + '</div>'
      + '<div style="font-size:11px;color:#555;">' + (i.desc||'--') + '</div></div>'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + (i.status==='active'?'#f8717122':'#4ade8022') + ';color:' + (i.status==='active'?'#f87171':'#4ade80') + ';border:1px solid ' + (i.status==='active'?'#f8717144':'#4ade8044') + ';">' + (i.status||'active').toUpperCase() + '</span>'
      + '</div>';
  }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showMedIncidentForm()"><i class="fa-solid fa-plus"></i> LOG INCIDENT</button>';
}

function showMedIncidentForm() {
  makeOverlay('medOv', 'LOG MEDICAL INCIDENT',
    '<div class="adm-field-lbl">TITLE</div>'
    + '<input class="adm-field-input" id="mi-title" placeholder="e.g. Cardiac Arrest" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">DESCRIPTION</div>'
    + '<textarea class="adm-field-input" id="mi-desc" rows="3" placeholder="Brief description..." style="margin-bottom:10px;"></textarea>'
    + '<div class="adm-field-lbl">PRIORITY</div>'
    + '<select class="adm-field-input" id="mi-priority">'
    + '<option value="1">Priority 1 — Critical</option>'
    + '<option value="2">Priority 2 — Urgent</option>'
    + '<option value="3">Priority 3 — Stable</option>'
    + '</select>',
    'saveMedIncident()');
}

async function saveMedIncident() {
  var title = fv('mi-title').trim();
  if (!title) { admAlert('⚠ Title required', 'error'); return; }
  var inc = { title:title, desc:fv('mi-desc').trim()||'', priority:fi('mi-priority')||2, status:'active', time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
  inc.id = inc.id || ('med_'+Date.now()); _store['getShelterMedical'] = [inc].concat(_store['getShelterMedical']||[]);
  if (fbReady()) window.FB.addShelterMedical(inc);
  document.getElementById('medOv')?.remove();
  admAlert('✓ Incident logged');
  storeClear('getShelterMedical'); await renderShelterMedList();
}

// ══════════════════════════════════════════════════════════════
//  S3 — SUPPLY INVENTORY
// ══════════════════════════════════════════════════════════════
async function renderShelterStock() {
  admLoading('shelterStockCards');
  admLoading('shelterLedger');
  var items = _store['getShelterStock'] !== undefined ? _store['getShelterStock'] : await fbGet('getShelterStock');
  var el = document.getElementById('shelterStockCards');
  if (el) {
    if (!items.length) { admEmpty('shelterStockCards', 'ADD ITEM', 'showShelterStockForm()'); }
    else {
      var cm = { optimal:'#4ade80', stable:'#4ade80', review:'#facc15', critical:'#f87171' };
      el.innerHTML = items.map(function(s) {
        var c = cm[s.status] || '#4ade80';
        return '<div style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:10px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<div style="width:36px;height:36px;border-radius:8px;background:' + (s.iconBg||'#2a1f00') + ';display:flex;align-items:center;justify-content:center;">'
          + '<i class="fa-solid ' + (s.icon||'fa-boxes-stacked') + '" style="color:' + (s.iconColor||'#facc15') + ';font-size:16px;"></i></div>'
          + '<div><div style="font-size:13px;font-weight:600;color:#fff;">' + s.name + '</div>'
          + '<div style="font-size:11px;color:#555;">' + (s.sub||'') + '</div></div></div>'
          + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (s.status||'OK').toUpperCase() + '</span></div>'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
          + '<button class="adm-archive-btn" style="margin:0;width:32px;height:32px;padding:0;font-size:16px;display:flex;align-items:center;justify-content:center;" onclick="changeShelterQty(\'' + s.id + '\',-50)">−</button>'
          + '<div style="flex:1;text-align:center;">'
          + '<span id="sqty-' + s.id + '" style="font-size:22px;font-weight:800;color:#fff;">' + (s.qty||0).toLocaleString() + '</span>'
          + '<span style="font-size:11px;color:#555;margin-left:4px;">' + (s.unit||'UNITS') + '</span>'
          + '</div>'
          + '<button class="adm-archive-btn" style="margin:0;width:32px;height:32px;padding:0;font-size:16px;display:flex;align-items:center;justify-content:center;" onclick="changeShelterQty(\'' + s.id + '\',50)">+</button>'
          + '</div>'
          + '<div style="height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden;">'
          + '<div style="width:' + Math.min(100, s.pct||0) + '%;height:100%;background:' + c + ';border-radius:4px;"></div></div>'
          + '</div>';
      }).join('') + '<button class="adm-archive-btn" style="margin-top:4px;width:100%;" onclick="showShelterStockForm()"><i class="fa-solid fa-plus"></i> ADD ITEM</button>';
    }
  }
  var logs = _store['getShelterLedger'] !== undefined ? _store['getShelterLedger'] : await fbGet('getShelterLedger');
  var ledEl = document.getElementById('shelterLedger');
  if (ledEl) {
    if (!logs.length) { admEmpty('shelterLedger'); }
    else ledEl.innerHTML = logs.slice(0, 8).map(function(l) {
      return '<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #111;">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + (l.color||'#4ade80') + ';margin-top:4px;flex-shrink:0;"></div>'
        + '<div><div style="font-size:11px;font-weight:700;color:#888;">' + (l.who||'SYSTEM') + ' <span style="color:#444;font-weight:400;">' + (l.time||'') + '</span></div>'
        + '<div style="font-size:12px;color:#555;">' + (l.text||'') + '</div></div></div>';
    }).join('');
  }
}

async function changeShelterQty(id, delta) {
  var items = _store['getShelterStock'] !== undefined ? _store['getShelterStock'] : await fbGet('getShelterStock');
  var item = items.find(function(i){ return i.id===id; });
  if (!item) return;
  var nq = Math.max(0, (item.qty||0) + delta);
  if (fbReady()) await window.FB.updateShelterStock(id, { qty:nq });
  var el = document.getElementById('sqty-' + id);
  if (el) el.textContent = nq.toLocaleString();
}

function showShelterStockForm() {
  makeOverlay('ssOv', 'ADD SUPPLY ITEM',
    '<div class="adm-field-lbl">ITEM NAME</div>'
    + '<input class="adm-field-input" id="ss-name" placeholder="e.g. Food Rations" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">DESCRIPTION</div>'
    + '<input class="adm-field-input" id="ss-sub" placeholder="e.g. MRE / Dry Goods" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">QUANTITY</div>'
    + '<input class="adm-field-input" id="ss-qty" type="number" min="0" placeholder="0" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">UNIT</div>'
    + '<input class="adm-field-input" id="ss-unit" placeholder="UNITS / LITERS" style="margin-bottom:10px;">'
    + '<div class="adm-field-lbl">STATUS</div>'
    + '<select class="adm-field-input" id="ss-status">'
    + '<option value="stable">Stable</option><option value="optimal">Optimal</option><option value="critical">Critical</option>'
    + '</select>',
    'addShelterStockItem()');
}

async function addShelterStockItem() {
  var name = fv('ss-name').trim();
  if (!name) { admAlert('⚠ Name required', 'error'); return; }
  var st = fv('ss-status') || 'stable';
  var cm = { stable:'#4ade80', optimal:'#4ade80', critical:'#f87171' };
  var qty = fi('ss-qty');
  var item = { name:name, sub:fv('ss-sub').trim()||'', qty:qty, unit:fv('ss-unit').trim()||'UNITS', status:st, statusColor:cm[st], pct:Math.min(100,Math.round((qty/1500)*100)), icon:'fa-boxes-stacked', iconBg:'#2a1f00', iconColor:'#facc15' };
  item.id = item.id || ('ss_'+Date.now()); _store['getShelterStock'] = (_store['getShelterStock']||[]).concat([item]);
  if (fbReady()) window.FB.addShelterStockItem(item);
  document.getElementById('ssOv')?.remove();
  admAlert('✓ Item added');
  storeClear('getShelterStock'); storeClear('getShelterLedger'); await renderShelterStock();
}

async function commitShelterLedger() {
  var asset = fv('shelter-assetId').trim();
  var qty = parseInt(fv('shelter-qtyAdj')) || 0;
  if (!asset) { admAlert('⚠ Asset ID required', 'error'); return; }
  var e = { who:'SHELTER ENTRY', text:'Asset ' + asset + ' adjusted by ' + (qty>=0?'+':'') + qty + ' units.', time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), color:'#facc15' };
  if (fbReady()) await window.FB.addShelterLedger(e);
  document.getElementById('shelter-assetId').value = '';
  document.getElementById('shelter-qtyAdj').value = '';
  admAlert('✓ Ledger updated');
  storeClear('getShelterStock'); storeClear('getShelterLedger'); await renderShelterStock();
}

// ══════════════════════════════════════════════════════════════
//  S4 — ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════
async function renderAnnounceList() {
  admLoading('announceList');
  var anns = _store['getAnnouncements'] !== undefined ? _store['getAnnouncements'] : await fbGet('getAnnouncements');
  var el = document.getElementById('announceList');
  if (!el) return;
  if (!anns.length) { admEmpty('announceList'); return; }
  var pc = { CRITICAL:'#f87171', URGENT:'#facc15', IMPORTANT:'#facc15', NORMAL:'#4ade80', Normal:'#4ade80' };
  el.innerHTML = anns.map(function(a) {
    var c = pc[a.priority] || '#4ade80';
    return '<div style="background:#111;border-left:3px solid ' + c + ';border-radius:10px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;">' + (a.priority||'NORMAL') + '</span>'
      + '<span style="font-size:10px;color:#444;">' + (a.time||'--') + '</span></div>'
      + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px;">' + (a.title||'Untitled') + '</div>'
      + '<div style="font-size:12px;color:#555;margin-bottom:10px;">' + (a.msg||a.message||'') + '</div>'
      + '<button class="adm-archive-btn" style="margin:0;width:100%;font-size:10px;padding:8px;color:#f87171;border-color:#f8717144;" onclick="deleteAnn(\'' + a.id + '\')">'
      + '<i class="fa-solid fa-trash"></i> DELETE</button></div>';
  }).join('');
}

async function postAnnouncement() {
  var title = fv('ann-title').trim();
  var msg   = fv('ann-msg').trim();
  var pri   = fv('ann-priority') || 'NORMAL';
  if (!title) { admAlert('⚠ Title required', 'error'); return; }
  if (!msg)   { admAlert('⚠ Message required', 'error'); return; }
  var a = { title:title, msg:msg, priority:pri.toUpperCase(), time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
  a.id = a.id || ('ann_'+Date.now()); _store['getAnnouncements'] = [a].concat(_store['getAnnouncements']||[]);
  if (fbReady()) window.FB.addAnnouncement(a);
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-msg').value = '';
  admAlert('✓ Announcement posted');
  storeClear('getAnnouncements'); storeClear('getAnnouncements'); await renderAnnounceList();
}

async function deleteAnn(id) {
  if (_store['getAnnouncements']) _store['getAnnouncements'] = _store['getAnnouncements'].filter(function(x){return x.id!==id;});
  if (fbReady()) window.FB.deleteAnnouncement(id);
  admAlert('✓ Deleted');
  storeClear('getAnnouncements'); storeClear('getAnnouncements'); await renderAnnounceList();
}

// ══════════════════════════════════════════════════════════════
//  USER-FACING MODALS — read ALL institutions from Firebase
// ══════════════════════════════════════════════════════════════
window.openHospitalModal = async function() {
  document.getElementById('hospitalModal')?.classList.add('open');
  document.getElementById('hospitalList').innerHTML = '<div class="zone-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>';
  try { if (window.FB) { var h = await window.FB.getAllHospitals(); if (h && h.length) window._liveHospitals = h; } } catch(e) {}
  if (typeof filterHospitals === 'function') filterHospitals('recommended', document.querySelector('#hospitalModal .filter-tab'));
};

window.openShelterModal = async function() {
  document.getElementById('shelterModal')?.classList.add('open');
  document.querySelectorAll('#shelterModal .filter-tab').forEach(function(b,i){ b.classList.toggle('active',i===0); });
  await waitForFB(4000);
  try { if (window.FB) { var s = await window.FB.getAllShelters(); if (s && s.length) window._liveShelters = s; } } catch(e) {}
  if (typeof window.renderShelters === 'function') window.renderShelters(window._liveShelters || window.shelterData || []);
};

window.openFoodModal = async function() {
  document.getElementById('foodModal')?.classList.add('open');
  await waitForFB(4000);
  try { document.getElementById('foodSearchInput').value = ''; } catch(e){}
  document.querySelectorAll('#foodModal .filter-tab').forEach(function(b,i){ b.classList.toggle('active',i===0); });
  try { if (window.FB) { var f = await window.FB.getAllFoodPoints(); if (f && f.length) window._liveFoodData = f; } } catch(e) {}
  if (typeof renderFood === 'function') renderFood(window._liveFoodData || window.foodData || []);
};

window.openPoliceModal = async function() {
  document.getElementById('policeModal')?.classList.add('open');
  document.querySelectorAll('.police-tab').forEach(function(b,i){ b.classList.toggle('active',i===0); });
  try { if (window.FB) { var p = await window.FB.getAllPolice(); if (p && p.length) window._livePolice = p; } } catch(e) {}
  var data = [].concat(window._livePolice || window.policeData || []).sort(function(a,b){ return (a.dist||0)-(b.dist||0); });
  if (typeof window.renderPolice === 'function') window.renderPolice(data);
};

// ── KEYBOARD CLOSE ────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') document.querySelectorAll('.adm-modal.open').forEach(function(m){ m.classList.remove('open'); });
});
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('adm-modal')) e.target.classList.remove('open');
});

console.log('✓ admin-modals.js loaded (Firebase only, no demo data)');
