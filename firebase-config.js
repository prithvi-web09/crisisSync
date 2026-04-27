

const firebaseConfig = {
  apiKey:            "AIzaSyAZcnLi9D-sW7qjzdTpFv9q-Cgw_ORFoiQ",
  authDomain:        "crisissync-0909.firebaseapp.com",
  projectId:         "crisissync-0909",
  storageBucket:     "crisissync-0909.firebasestorage.app",
  messagingSenderId: "888489510257",
  appId:             "1:888489510257:web:24ff3a834da329098aa2d0"
};

(function () {
  // Poll until Firebase compat SDK scripts are loaded (they load above us in index.html)
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    if (typeof firebase !== 'undefined') { clearInterval(poll); _init(); return; }
    if (tries > 150) { clearInterval(poll); console.error('Firebase SDK never loaded. Check <script> tags in index.html.'); }
  }, 20);

  function _init() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db   = firebase.firestore();
    const auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
    window._adminSession = { role: null, institutionId: null, uid: null };

    auth.onAuthStateChanged(async function(user) {
      if (!user) {
        window._adminSession = { role: null, institutionId: null, uid: null };
        return;
      }
      const uid = user.uid;
      const roles = { hospital:'hospitals', food:'food_ngos', police:'police', shelter:'shelters' };
      let role = null;
      try {
        for (const key in roles) {
          const snap = await db.collection(roles[key]).doc(uid).get();
          if (snap.exists) { role = key; break; }
        }
      } catch (e) {
        console.warn('Admin session restore failed', e);
      }
      if (role) {
        window._adminSession = { role: role, institutionId: uid, uid: uid };
        document.dispatchEvent(new CustomEvent('adminSessionRestored', { detail: { role: role, uid: uid } }));
      } else {
        window._adminSession = { role: null, institutionId: null, uid: null };
      }
    });

    // ── Role → Firestore collection ───────────────────────────
    function collFor(r) {
      return { hospital:'hospitals', food:'food_ngos', police:'police', shelter:'shelters' }[r];
    }
    function myId() { return window._adminSession.institutionId; }

    // ── Friendly error messages ───────────────────────────────
    function authErr(code, fallback) {
      const map = {
        'auth/email-already-in-use':            'Email already registered. Log in instead.',
        'auth/invalid-email':                   'Invalid email address.',
        'auth/weak-password':                   'Password must be at least 6 characters.',
        'auth/user-not-found':                  'No account found. Please sign up first.',
        'auth/wrong-password':                  'Wrong password. Try again.',
        'auth/invalid-credential':              'Invalid email or password.',
        'auth/operation-not-allowed':           'Email/password sign-in is disabled. Enable it in Firebase Authentication settings.',
        'auth/app-not-authorized':              'This app is not authorized to use Firebase Authentication.',
        'auth/invalid-api-key':                 'Invalid Firebase API key. Check your configuration.',
        'auth/user-disabled':                   'This account has been disabled. Contact support.',
        'auth/too-many-requests':               'Too many attempts. Wait a moment and retry.',
        'auth/network-request-failed':          'Network error. Check your connection.',
      };
      return map[code] || fallback || 'Authentication failed. Please try again.';
    }

    // ══════════════════════════════════════════════════════════
    //  SIGN UP — creates Auth user + Firestore institution doc
    // ══════════════════════════════════════════════════════════
    async function fbSignUp(role, email, password, institutionName) {
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid  = cred.user.uid;
        await db.collection(collFor(role)).doc(uid).set({
          uid, email, role,
          name: institutionName || (role.charAt(0).toUpperCase() + role.slice(1) + ' Institution'),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        window._adminSession = { role, institutionId: uid, uid };
        return { success: true, uid };
      } catch (e) {
        console.warn('Firebase sign-up error', e);
        return { success: false, error: authErr(e.code, e.message) };
      }
    }

    // ══════════════════════════════════════════════════════════
    //  LOG IN — verifies role ownership, sets session
    // ══════════════════════════════════════════════════════════
    async function fbLogIn(role, email, password) {
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const uid  = cred.user.uid;
        const snap = await db.collection(collFor(role)).doc(uid).get();
        if (!snap.exists) {
          await auth.signOut();
          return { success: false, error: 'This account is not registered as ' + role + '. Try a different role.' };
        }
        window._adminSession = { role, institutionId: uid, uid };
        return { success: true, uid, data: snap.data() };
      } catch (e) {
        console.warn('Firebase login error', e);
        return { success: false, error: authErr(e.code, e.message) };
      }
    }

  
    //  LOG OUT
    async function fbSignOut() {
      await auth.signOut().catch(() => {});
      window._adminSession = { role: null, institutionId: null, uid: null };
    }

    // ══════════════════════════════════════════════════════════
    //  GENERIC FIRESTORE HELPERS
    // ══════════════════════════════════════════════════════════
    function _col(path) {
      const p = path.split('/');
      let r = db;
      p.forEach((seg, i) => { r = i%2===0 ? r.collection(seg) : r.doc(seg); });
      return r;
    }
    function _doc(path) {
      const p = path.split('/');
      let r = db;
      p.forEach((seg, i) => { r = i%2===0 ? r.collection(seg) : r.doc(seg); });
      return r;
    }

    async function _list(colPath, field, dir) {
      try {
        let q = _col(colPath);
        if (field) { try { q = q.orderBy(field, dir||'asc'); } catch {} }
        const snap = await q.get();
        return snap.docs.map(d => ({ ...d.data(), id:d.id }));
      } catch {
        try { return (await _col(colPath).get()).docs.map(d => ({ ...d.data(), id:d.id })); }
        catch { return []; }
      }
    }

    async function _add(colPath, data) {
      try {
        const ref = await _col(colPath).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        return ref.id;
      } catch (e) { console.error('_add', colPath, e.message); return null; }
    }

    async function _update(docPath, data) {
      try {
        await _doc(docPath).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        return true;
      } catch (e) { console.error('_update', docPath, e.message); return false; }
    }

    async function _del(docPath) {
      try { await _doc(docPath).delete(); return true; }
      catch (e) { console.error('_del', docPath, e.message); return false; }
    }

    // ══════════════════════════════════════════════════════════
    //  HOSPITAL
    // ══════════════════════════════════════════════════════════
    const getWards          = ()       => myId() ? _list(`hospitals/${myId()}/wards`,   'createdAt') : Promise.resolve([]);
    const saveWard          = w        => !myId() ? Promise.resolve(false) : (w.id ? _update(`hospitals/${myId()}/wards/${w.id}`, w) : _add(`hospitals/${myId()}/wards`, w));
    const deleteWard        = id       => _del(`hospitals/${myId()}/wards/${id}`);
    const getStaff          = ()       => myId() ? _list(`hospitals/${myId()}/staff`,   'createdAt') : Promise.resolve([]);
    const saveStaff         = s        => !myId() ? Promise.resolve(false) : (s.id ? _update(`hospitals/${myId()}/staff/${s.id}`, s) : _add(`hospitals/${myId()}/staff`, s));
    const updateStaffStatus = (id, st) => myId() ? _update(`hospitals/${myId()}/staff/${id}`, { status:st }) : Promise.resolve(false);
    const getIntake         = ()       => myId() ? _list(`hospitals/${myId()}/intake`,  'createdAt', 'desc') : Promise.resolve([]);
    const addPatient        = p        => myId() ? _add(`hospitals/${myId()}/intake`, p) : Promise.resolve(null);
    const dischargePatient  = id       => _del(`hospitals/${myId()}/intake/${id}`);
    const getReports        = ()       => myId() ? _list(`hospitals/${myId()}/reports`, 'createdAt', 'desc') : Promise.resolve([]);
    const addReport         = r        => myId() ? _add(`hospitals/${myId()}/reports`, r) : Promise.resolve(null);
    const updateReportStatus= (id, st) => myId() ? _update(`hospitals/${myId()}/reports/${id}`, { status:st }) : Promise.resolve(false);

    // ══════════════════════════════════════════════════════════
    //  FOOD / NGO
    // ══════════════════════════════════════════════════════════
    const getStock        = ()      => myId() ? _list(`food_ngos/${myId()}/stock`,    'createdAt') : Promise.resolve([]);
    const addStockItem    = i       => myId() ? _add(`food_ngos/${myId()}/stock`, i)                : Promise.resolve(null);
    const updateStockItem = (id, d) => myId() ? _update(`food_ngos/${myId()}/stock/${id}`, d)       : Promise.resolve(false);
    const getLedger       = ()      => myId() ? _list(`food_ngos/${myId()}/ledger`,   'createdAt', 'desc') : Promise.resolve([]);
    const addLedgerEntry  = e       => myId() ? _add(`food_ngos/${myId()}/ledger`, e)               : Promise.resolve(null);
    const getStations     = ()      => myId() ? _list(`food_ngos/${myId()}/stations`, 'createdAt') : Promise.resolve([]);
    const saveStation     = s       => !myId() ? Promise.resolve(false) : (s.id ? _update(`food_ngos/${myId()}/stations/${s.id}`, s) : _add(`food_ngos/${myId()}/stations`, s));
    const getConvoys      = ()      => myId() ? _list(`food_ngos/${myId()}/convoys`,  'createdAt', 'desc') : Promise.resolve([]);
    const addConvoy       = c       => myId() ? _add(`food_ngos/${myId()}/convoys`, c)              : Promise.resolve(null);
    const deleteConvoy    = id      => _del(`food_ngos/${myId()}/convoys/${id}`);
    const updateConvoy    = (id, d) => myId() ? _update(`food_ngos/${myId()}/convoys/${id}`, d)     : Promise.resolve(false);
    const getPartners     = ()      => myId() ? _list(`food_ngos/${myId()}/partners`, 'createdAt') : Promise.resolve([]);
    const addPartner      = p       => myId() ? _add(`food_ngos/${myId()}/partners`, p)             : Promise.resolve(null);

    // ══════════════════════════════════════════════════════════
    //  POLICE
    // ══════════════════════════════════════════════════════════
    const getUnits             = ()      => myId() ? _list(`police/${myId()}/units`,    'createdAt', 'desc') : Promise.resolve([]);
    const addUnit              = u       => myId() ? _add(`police/${myId()}/units`, u)                        : Promise.resolve(null);
    const deleteUnit           = id      => _del(`police/${myId()}/units/${id}`);
    const getIncidents         = ()      => _list('incidents','createdAt', 'desc');
    const addIncident          = i       => _add('incidents', i);
    const updateIncidentStatus = (id,st) => _update(`incidents/${id}`, { status:st });
    const getZones             = ()      => myId() ? _list(`police/${myId()}/zones`,    'createdAt') : Promise.resolve([]);
    const addZone              = z       => myId() ? _add(`police/${myId()}/zones`, z)                : Promise.resolve(null);
    const updateZone           = (id, d) => myId() ? _update(`police/${myId()}/zones/${id}`, d)      : Promise.resolve(false);
    const getNotes             = ()      => myId() ? _list(`police/${myId()}/notes`,    'createdAt', 'desc') : Promise.resolve([]);
    const addNote              = n       => myId() ? _add(`police/${myId()}/notes`, n)                : Promise.resolve(null);

    // ══════════════════════════════════════════════════════════
    //  SHELTER
    // ══════════════════════════════════════════════════════════
    const getShelterWards     = ()      => myId() ? _list(`shelters/${myId()}/wards`,         'createdAt') : Promise.resolve([]);
    const saveShelterWard     = w       => !myId() ? Promise.resolve(false) : (w.id ? _update(`shelters/${myId()}/wards/${w.id}`, w) : _add(`shelters/${myId()}/wards`, w));
    const getShelterStock     = ()      => myId() ? _list(`shelters/${myId()}/stock`,         'createdAt') : Promise.resolve([]);
    const addShelterStockItem = i       => myId() ? _add(`shelters/${myId()}/stock`, i)                     : Promise.resolve(null);
    const updateShelterStock  = (id, d) => myId() ? _update(`shelters/${myId()}/stock/${id}`, d)            : Promise.resolve(false);
    const getAnnouncements    = ()      => myId() ? _list(`shelters/${myId()}/announcements`, 'createdAt', 'desc') : Promise.resolve([]);
    const addAnnouncement     = a       => myId() ? _add(`shelters/${myId()}/announcements`, a)              : Promise.resolve(null);
    const deleteAnnouncement  = id      => _del(`shelters/${myId()}/announcements/${id}`);
    const getShelterMedical   = ()      => myId() ? _list(`shelters/${myId()}/medical`,       'createdAt', 'desc') : Promise.resolve([]);
    const addShelterMedical   = i       => myId() ? _add(`shelters/${myId()}/medical`, i)                    : Promise.resolve(null);
    const getShelterLedger    = ()      => myId() ? _list(`shelters/${myId()}/ledger`,        'createdAt', 'desc') : Promise.resolve([]);
    const addShelterLedger    = e       => myId() ? _add(`shelters/${myId()}/ledger`, e)                     : Promise.resolve(null);

    // ══════════════════════════════════════════════════════════
    //  PUBLIC READ — user-facing modals read ALL institutions
    // ══════════════════════════════════════════════════════════
    async function getAllHospitals() {
      try {
        const snap = await db.collection('hospitals').get();
        const out  = [];
        for (const d of snap.docs) {
          const info  = d.data();
          const wards = await _list(`hospitals/${d.id}/wards`);
          const total = wards.reduce((s,w) => s+(w.total||0), 0);
          const avail = wards.reduce((s,w) => s+(w.available||0), 0);
          const sched = wards.reduce((s,w) => s+(w.scheduled||0), 0);
          const fullPct = total > 0 ? Math.round(((total - avail) / total) * 100) : 0;
          out.push({
            id: d.id,
            name: info.name||'Hospital',
            dist: info.dist||0,
            total: total,
            beds: avail,
            scheduled: sched,
            waitTime: info.waitTime||0,
            critical: Math.max(0, total-avail),
            fillPct: fullPct,
            status: avail>0 ? 'available' : 'full',
            phone: info.phone||'tel:108',
          });
        }
        return out;
      } catch { return []; }
    }

    async function getAllFoodPoints() {
      try {
        const snap = await db.collection('food_ngos').get();
        const out  = [];
        for (const d of snap.docs) {
          const info  = d.data();
          const stns  = await _list(`food_ngos/${d.id}/stations`);
          for (const s of stns) {
            const water = s.water || 0;
            const kits  = s.kits || 0;
            out.push({
              id: s.id,
              name: s.name || info.name || 'Distribution Point',
              dist: s.dist || s.loc || info.dist || '--',
              supply: s.supply || (water || kits ? `${water}% water · ${kits}% kits` : 'Available supplies'),
              stock: s.stock || ((water > 60 && kits > 60) ? 'high' : (water > 0 || kits > 0) ? 'low' : 'empty'),
              type: s.type || info.types || ['foodbank'],
              phone: s.phone || info.phone || 'tel:108',
            });
          }
        }
        return out;
      } catch { return []; }
    }

    async function getAllShelters() {
      try {
        const snap = await db.collection('shelters').get();
        const out  = [];
        for (const d of snap.docs) {
          const info  = d.data();
          const wards = await _list(`shelters/${d.id}/wards`);
          const total = wards.reduce((s,w) => s + (w.total || 0), 0);
          const occ   = wards.reduce((s,w) => s + (w.occupied || 0), 0);
          out.push({
            id: d.id,
            name: info.name || 'Relief Center',
            address: info.address || info.loc || '--',
            dist: info.dist || '--',
            capacity: total > 0 ? Math.round((occ / total) * 100) : 0,
            type: info.types || ['shelter'],
            phone: info.phone || 'tel:108',
          });
        }
        return out;
      } catch { return []; }
    }

    async function getAllPolice() {
      try {
        const snap = await db.collection('police').get();
        const out  = [];
        for (const d of snap.docs) {
          const info  = d.data();
          const units = await _list(`police/${d.id}/units`);
          const active = units.filter(u => u.status==='active'||u.status==='on-call');
          out.push({
            id: d.id, name: info.name||'Police Station',
            sub: info.sub||'Emergency Response',
            address: info.address || info.loc || '--',
            dist: info.dist||0,
            units: active.length, status: info.status||'active',
            phone: info.phone||'tel:100',
          });
        }
        return out;
      } catch { return []; }
    }

    // ══════════════════════════════════════════════════════════
    //  EXPORT window.FB
    // ══════════════════════════════════════════════════════════
    window.FB = {
      // Auth
      signUp: fbSignUp, logIn: fbLogIn, signOut: fbSignOut,
      // Hospital
      getWards, saveWard, deleteWard,
      getStaff, saveStaff, updateStaffStatus,
      getIntake, addPatient, dischargePatient,
      getReports, addReport, updateReportStatus,
      // Food/NGO
      getStock, addStockItem, updateStockItem,
      getLedger, addLedgerEntry,
      getStations, saveStation,
      getConvoys, addConvoy, deleteConvoy, updateConvoy,
      getPartners, addPartner,
      // Police
      getUnits, addUnit, deleteUnit,
      getIncidents, addIncident, updateIncidentStatus,
      getZones, addZone, updateZone,
      getNotes, addNote,
      // Shelter
      getShelterWards, saveShelterWard,
      getShelterStock, addShelterStockItem, updateShelterStock,
      getAnnouncements, addAnnouncement, deleteAnnouncement,
      getShelterMedical, addShelterMedical,
      getShelterLedger, addShelterLedger,
      // Public
      getAllHospitals, getAllFoodPoints, getAllShelters, getAllPolice,
    };

    window._fbReady = true;
    document.dispatchEvent(new CustomEvent('fbReady'));
    console.log('✓ CrisisSync Firebase ready');
  }
})();
