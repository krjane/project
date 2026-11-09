// Sync layer. Firebase Firestore when configured (live sync between phones), otherwise on-device storage.
import { firebaseConfig } from './firebase-config.js';

const V = '10.14.1';
const B = `https://www.gstatic.com/firebasejs/${V}/`;
const clone = (o) => JSON.parse(JSON.stringify(o));

function setIn(obj, path, val) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (typeof o[path[i]] !== 'object' || o[path[i]] === null) o[path[i]] = {};
    o = o[path[i]];
  }
  o[path[path.length - 1]] = clone(val);
}
function delIn(obj, path) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) {
    o = o[path[i]];
    if (!o) return;
  }
  delete o[path[path.length - 1]];
}

export async function openStore({ key, makeDefaults, onData, onStatus }) {
  const forceLocal = new URLSearchParams(location.search).has('local');
  if (!firebaseConfig || forceLocal) return localStore({ key, makeDefaults, onData, onStatus });
  let fb;
  try {
    const [appM, authM, fs] = await Promise.all([
      import(B + 'firebase-app.js'),
      import(B + 'firebase-auth.js'),
      import(B + 'firebase-firestore.js'),
    ]);
    fb = { appM, authM, fs };
  } catch (e) {
    onStatus('offline');
    throw e;
  }
  const { appM, authM, fs } = fb;
  const app = appM.initializeApp(firebaseConfig);
  const auth = authM.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  await new Promise((res) => {
    const off = authM.onAuthStateChanged(auth, (u) => {
      if (u) { off(); res(); }
    });
    authM.signInAnonymously(auth).catch((e) => { onStatus('error', e); res(); });
  });
  const ref = fs.doc(db, 'houses', key);
  try {
    await fs.runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) tx.set(ref, makeDefaults());
    });
  } catch (e) {
    // offline on first open: the cached copy (if any) still loads below
  }
  fs.onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.exists()) onData(snap.data());
      onStatus(snap.metadata.hasPendingWrites ? 'saving' : snap.metadata.fromCache ? 'offline' : 'live');
    },
    (err) => onStatus('error', err)
  );
  const fail = (e) => onStatus('error', e);
  return {
    mode: 'cloud',
    set(path, val) { return fs.updateDoc(ref, new fs.FieldPath(...path), val).catch(fail); },
    del(path) { return fs.updateDoc(ref, new fs.FieldPath(...path), fs.deleteField()).catch(fail); },
    multi(pairs) {
      const args = [];
      pairs.forEach(([p, v]) => args.push(new fs.FieldPath(...p), v === undefined ? fs.deleteField() : v));
      return fs.updateDoc(ref, ...args).catch(fail);
    },
  };
}

function localStore({ key, makeDefaults, onData, onStatus }) {
  const LS = 'gl_local_' + key;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(LS)); } catch (e) { }
  if (!data) data = makeDefaults();
  let bc = null;
  try { bc = new BroadcastChannel(LS); } catch (e) { }
  const persist = () => {
    try { localStorage.setItem(LS, JSON.stringify(data)); } catch (e) { }
    if (bc) bc.postMessage(1);
  };
  persist();
  if (bc) bc.onmessage = () => {
    try { data = JSON.parse(localStorage.getItem(LS)); onData(clone(data)); } catch (e) { }
  };
  setTimeout(() => { onData(clone(data)); onStatus('local'); }, 0);
  const emit = () => { persist(); onData(clone(data)); };
  return {
    mode: 'local',
    set(path, val) { setIn(data, path, val); emit(); },
    del(path) { delIn(data, path); emit(); },
    multi(pairs) { pairs.forEach(([p, v]) => (v === undefined ? delIn(data, p) : setIn(data, p, v))); emit(); },
  };
}
