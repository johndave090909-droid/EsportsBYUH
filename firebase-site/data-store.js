// Data layer for Seasider Esports. One API, two backends:
//   local    — demo mode: everything lives in this browser's localStorage.
//   firebase — live mode: Firebase Auth + Firestore. Activates automatically
//              once firebase-config.js contains a real config.

import { firebaseConfig } from './firebase-config.js';
import { SEED, FRESH } from './seed-data.js';

const CONFIGURED = !!(firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE'));
const COLLECTIONS = ['matches', 'news', 'photos', 'videos'];

// Brackets are stored as { title, rounds: [{ name, matches: [{a,as,b,bs}] }] }.
// Older saves used fixed { qf, sf, final, finalHeader } — convert on read.
export function normalizeBracket(br) {
  if (!br) return null;
  if (Array.isArray(br.rounds)) return br;
  const rounds = [];
  if (Array.isArray(br.qf)) rounds.push({ name: 'QUARTERFINALS', matches: br.qf });
  if (Array.isArray(br.sf)) rounds.push({ name: 'SEMIFINALS', matches: br.sf });
  if (br.final) rounds.push({ name: br.finalHeader || 'GRAND FINAL', matches: [br.final] });
  return { title: br.title || '', rounds };
}

// The bracket is the single source of truth for matches and standings.
// Every fully-named matchup in it becomes a schedule/result row: round name =
// stage, bracket-level game/when/where fill in the rest. BYE and TBD slots
// are skipped — they aren't real matches.
export function bracketMatches(br) {
  br = normalizeBracket(br);
  if (!br) return [];
  const out = [];
  for (const r of br.rounds || []) {
    for (const m of r.matches || []) {
      const a = String(m.a || '').trim(), b = String(m.b || '').trim();
      if (!a || !b) continue;
      if (a.toUpperCase() === 'BYE' || b.toUpperCase() === 'BYE') continue;
      const done = String(m.as ?? '') !== '' && String(m.bs ?? '') !== '';
      out.push({
        game: br.game || '', stage: r.name || '', teamA: a, teamB: b,
        datetime: m.when || '', location: m.where || '',
        status: done ? 'final' : 'upcoming',
        scoreA: String(m.as ?? ''), scoreB: String(m.bs ?? '')
      });
    }
  }
  return out;
}

// Standings computed from played bracket matches: 3 points per win, ranked by
// points then score difference. Teams in unplayed matches appear at 0-0.
export function bracketStandings(br) {
  const rows = new Map();
  const row = t => { if (!rows.has(t)) rows.set(t, { team: t, w: 0, l: 0, d: 0 }); return rows.get(t); };
  for (const m of bracketMatches(br)) {
    const A = row(m.teamA), B = row(m.teamB);
    if (m.status !== 'final') continue;
    const sa = Number(m.scoreA) || 0, sb = Number(m.scoreB) || 0;
    A.d += sa - sb; B.d += sb - sa;
    if (sa > sb) { A.w++; B.l++; } else if (sb > sa) { B.w++; A.l++; }
  }
  return [...rows.values()]
    .sort((a, b) => (b.w - a.w) || (b.d - a.d) || a.team.localeCompare(b.team))
    .map(r => ({ team: r.team, w: r.w, l: r.l, diff: (r.d >= 0 ? '+' : '') + r.d, pts: r.w * 3, q: false }));
}

/* ======================= local (demo) backend ======================= */

const LS_DB = 'seasiderDB';
const LS_SESSION = 'seasiderSession';

function freshDB() {
  const db = JSON.parse(JSON.stringify(SEED));
  db.officers = [{ email: 'officer@byuh.edu', name: 'Demo Officer', password: 'seasiders' }];
  return db;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted store — fall through and reseed */ }
  const db = freshDB();
  localStorage.setItem(LS_DB, JSON.stringify(db));
  return db;
}

function saveDB(db) { localStorage.setItem(LS_DB, JSON.stringify(db)); }

const authListeners = [];
function emitAuth(email) { authListeners.forEach(cb => cb(email)); }

const localStore = {
  mode: 'local',
  configured: false,

  async login(email, password) {
    const db = loadDB();
    const em = String(email).toLowerCase().trim();
    const o = db.officers.find(o => o.email.toLowerCase() === em && o.password === password);
    if (!o) throw new Error('Wrong email or password.');
    localStorage.setItem(LS_SESSION, o.email);
    emitAuth(o.email);
    return o.email;
  },
  async loginGoogle() { throw new Error('Demo mode: sign in with the demo email and password.'); },
  async uploadFile() { throw new Error('Demo mode: file uploads to Storage need live Firebase mode.'); },
  async resetPassword() { throw new Error('Demo mode: ask another officer to remove and re-add your account with a new password.'); },
  async logout() { localStorage.removeItem(LS_SESSION); emitAuth(null); },
  onAuthChange(cb) { authListeners.push(cb); cb(localStorage.getItem(LS_SESSION)); },
  async isOfficer(email) {
    return loadDB().officers.some(o => o.email.toLowerCase() === String(email).toLowerCase());
  },

  async getSetting(name) { return loadDB().settings[name] || null; },
  async saveSetting(name, obj) { const db = loadDB(); db.settings[name] = obj; saveDB(db); },

  async list(coll) { return (loadDB()[coll] || []).slice(); },
  async add(coll, obj) {
    const db = loadDB();
    const id = coll[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db[coll] = db[coll] || [];
    db[coll].push({ ...obj, id });
    saveDB(db);
    return id;
  },
  async update(coll, id, obj) {
    const db = loadDB();
    const i = (db[coll] || []).findIndex(x => x.id === id);
    if (i >= 0) { db[coll][i] = { ...obj, id }; saveDB(db); }
  },
  async remove(coll, id) {
    const db = loadDB();
    db[coll] = (db[coll] || []).filter(x => x.id !== id);
    saveDB(db);
  },

  async listOfficers() { return loadDB().officers.map(o => ({ email: o.email, name: o.name })); },
  async addOfficer({ email, name, password }) {
    const db = loadDB();
    const em = String(email).toLowerCase().trim();
    if (!em) throw new Error('An email is required.');
    if (!password) throw new Error('Demo mode: a password is required.');
    if (db.officers.some(o => o.email.toLowerCase() === em)) throw new Error('That email is already an officer.');
    db.officers.push({ email: em, name: name || '', password });
    saveDB(db);
  },
  async removeOfficer(email) {
    const db = loadDB();
    if (db.officers.length <= 1) throw new Error('You cannot remove the last officer.');
    db.officers = db.officers.filter(o => o.email.toLowerCase() !== String(email).toLowerCase());
    saveDB(db);
  },
  async changePassword(email, newPassword) {
    const db = loadDB();
    const o = db.officers.find(o => o.email.toLowerCase() === String(email).toLowerCase());
    if (!o) throw new Error('Officer not found.');
    o.password = newPassword;
    saveDB(db);
  },

  async loadSeed() {
    const current = loadDB();
    const db = freshDB();
    db.officers = current.officers; // keep accounts, reset content only
    saveDB(db);
  },
  async clearContent() {
    const db = loadDB();
    for (const coll of COLLECTIONS) db[coll] = [];
    db.settings = JSON.parse(JSON.stringify(FRESH));
    saveDB(db);
  },
  async resetAll() {
    localStorage.removeItem(LS_DB);
    localStorage.removeItem(LS_SESSION);
    emitAuth(null);
  },

  // Community chat/inbox is live-mode only.
  currentUser() { return null; },
  async userLogin() { throw new Error('Chat needs the live Firebase site.'); },
  async userLoginGoogle() { throw new Error('Chat needs the live Firebase site.'); },
  async onChat() { return () => {}; },
  async sendChat() { throw new Error('Chat needs the live Firebase site.'); },
  async deleteChat() { throw new Error('Chat needs the live Firebase site.'); },
  async openThread() { throw new Error('Chat needs the live Firebase site.'); },
  async createGroup() { throw new Error('Chat needs the live Firebase site.'); },
  async myThreads() { return () => {}; },
  async onThreadMessages() { return () => {}; },
  async sendDM() { throw new Error('Chat needs the live Firebase site.'); }
};

/* ======================= firebase (live) backend ======================= */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let fb = null;
let fbInit = null;

function init() {
  if (!fbInit) {
    fbInit = (async () => {
      const [appM, authM, fsM, stM] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js'),
        import(SDK + 'firebase-storage.js')
      ]);
      const app = appM.initializeApp(firebaseConfig);
      fb = { auth: authM.getAuth(app), db: fsM.getFirestore(app), storage: stM.getStorage(app), A: authM, F: fsM, S: stM };
    })();
  }
  return fbInit;
}

const fireStore = {
  mode: 'firebase',
  configured: true,

  async login(email, password) {
    await init();
    const cred = await fb.A.signInWithEmailAndPassword(fb.auth, String(email).trim(), password);
    const em = cred.user.email.toLowerCase();
    if (!(await this.isOfficer(em))) {
      await fb.A.signOut(fb.auth);
      throw new Error('This account is not on the officer list. Ask an existing officer to add "' + em + '" on the Officers page.');
    }
    return em;
  },
  async loginGoogle() {
    await init();
    const cred = await fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider());
    const em = cred.user.email.toLowerCase();
    if (!(await this.isOfficer(em))) {
      await fb.A.signOut(fb.auth);
      throw new Error('This Google account (' + em + ') is not on the officer list. Ask an existing officer to add it on the Officers page.');
    }
    return em;
  },
  async resetPassword(email) {
    await init();
    await fb.A.sendPasswordResetEmail(fb.auth, String(email).trim());
  },
  // Uploads a File/Blob to Storage under folder/ and returns its public URL.
  async uploadFile(folder, blob, filename, onProgress) {
    await init();
    const clean = String(filename || 'file').replace(/[^\w.\-]+/g, '_').slice(-60);
    const path = folder + '/' + Date.now().toString(36) + '-' + clean;
    const ref = fb.S.ref(fb.storage, path);
    const task = fb.S.uploadBytesResumable(ref, blob, blob.type ? { contentType: blob.type } : undefined);
    await new Promise((resolve, reject) => task.on('state_changed',
      s => { if (onProgress && s.totalBytes) onProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)); },
      reject, resolve));
    return await fb.S.getDownloadURL(ref);
  },
  async logout() { await init(); await fb.A.signOut(fb.auth); },
  onAuthChange(cb) { init().then(() => fb.A.onAuthStateChanged(fb.auth, u => cb(u ? u.email : null))); },
  async isOfficer(email) {
    await init();
    const snap = await fb.F.getDoc(fb.F.doc(fb.db, 'officers', String(email).toLowerCase()));
    return snap.exists();
  },

  async getSetting(name) {
    await init();
    const snap = await fb.F.getDoc(fb.F.doc(fb.db, 'settings', name));
    return snap.exists() ? snap.data() : null;
  },
  async saveSetting(name, obj) {
    await init();
    await fb.F.setDoc(fb.F.doc(fb.db, 'settings', name), obj);
  },

  async list(coll) {
    await init();
    const qs = await fb.F.getDocs(fb.F.collection(fb.db, coll));
    return qs.docs.map(d => ({ ...d.data(), id: d.id }));
  },
  async add(coll, obj) {
    await init();
    const ref = await fb.F.addDoc(fb.F.collection(fb.db, coll), obj);
    return ref.id;
  },
  async update(coll, id, obj) {
    await init();
    const { id: _drop, ...data } = obj;
    await fb.F.setDoc(fb.F.doc(fb.db, coll, id), data);
  },
  async remove(coll, id) {
    await init();
    await fb.F.deleteDoc(fb.F.doc(fb.db, coll, id));
  },

  async listOfficers() {
    await init();
    const qs = await fb.F.getDocs(fb.F.collection(fb.db, 'officers'));
    return qs.docs.map(d => ({ email: d.id, name: (d.data() || {}).name || '' }));
  },
  // Adding an officer also creates their sign-in account — on a throwaway
  // secondary app instance so the current officer stays signed in — and emails
  // them a link to set their own password. There is no self-signup anywhere.
  async addOfficer({ email, name }) {
    await init();
    const em = String(email).toLowerCase().trim();
    if (!em) throw new Error('An email is required.');
    await fb.F.setDoc(fb.F.doc(fb.db, 'officers', em), { name: name || '' });
    const appM = await import(SDK + 'firebase-app.js');
    const side = appM.initializeApp(firebaseConfig, 'acct-' + Date.now().toString(36));
    try {
      const sideAuth = fb.A.getAuth(side);
      await fb.A.createUserWithEmailAndPassword(sideAuth, em, crypto.randomUUID() + 'A9!');
      await fb.A.signOut(sideAuth);
      await fb.A.sendPasswordResetEmail(fb.auth, em);
      return 'created';
    } catch (e) {
      if (e && e.code === 'auth/email-already-in-use') return 'existing';
      throw new Error('Officer added, but their account setup failed: ' + (e.message || e));
    } finally {
      appM.deleteApp(side).catch(() => {});
    }
  },
  async removeOfficer(email) {
    const officers = await this.listOfficers();
    if (officers.length <= 1) throw new Error('You cannot remove the last officer.');
    await fb.F.deleteDoc(fb.F.doc(fb.db, 'officers', String(email).toLowerCase()));
  },
  async changePassword() {
    throw new Error('Live mode: use "Forgot password" on the login screen to get a reset email.');
  },

  /* ---- community chat & inbox (any signed-in user, not just officers) ---- */

  currentUser() {
    const u = fb && fb.auth.currentUser;
    return u ? { email: (u.email || '').toLowerCase(), name: u.displayName || (u.email || '').split('@')[0] } : null;
  },
  async userLogin(email, password) {
    await init();
    const cred = await fb.A.signInWithEmailAndPassword(fb.auth, String(email).trim(), password);
    return cred.user.email.toLowerCase();
  },
  async userLoginGoogle() {
    await init();
    const cred = await fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider());
    return cred.user.email.toLowerCase();
  },

  async onChat(cb) {
    await init();
    const q = fb.F.query(fb.F.collection(fb.db, 'chat'), fb.F.orderBy('ts', 'desc'), fb.F.limit(100));
    return fb.F.onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id })).reverse()), () => {});
  },
  async sendChat(text) {
    await init();
    const u = this.currentUser();
    if (!u) throw new Error('Sign in to send messages.');
    await fb.F.addDoc(fb.F.collection(fb.db, 'chat'),
      { text: String(text), email: u.email, name: u.name, ts: fb.F.serverTimestamp() });
  },
  async deleteChat(id) { await init(); await fb.F.deleteDoc(fb.F.doc(fb.db, 'chat', id)); },

  async openThread(otherEmail) {
    await init();
    const u = this.currentUser();
    if (!u) throw new Error('Sign in first.');
    const other = String(otherEmail).toLowerCase().trim();
    if (!other || !other.includes('@')) throw new Error('Enter a valid email address.');
    if (other === u.email) throw new Error("That's your own email — message someone else.");
    const tid = [u.email, other].sort().join('__');
    await fb.F.setDoc(fb.F.doc(fb.db, 'threads', tid),
      { participants: [u.email, other].sort(), updatedAt: fb.F.serverTimestamp() }, { merge: true });
    return tid;
  },
  // A group chat is a thread with 3+ possible members, a name, and isGroup.
  // Members are fixed at creation; the creator is always included.
  async createGroup(name, emails) {
    await init();
    const u = this.currentUser();
    if (!u) throw new Error('Sign in first.');
    const set = new Set((emails || []).map(e => String(e).toLowerCase().trim()).filter(e => e.includes('@')));
    set.add(u.email);
    const participants = [...set].sort();
    if (participants.length < 2) throw new Error('Pick at least one other officer for the group.');
    if (participants.length > 20) throw new Error('Groups are limited to 20 members.');
    const ref = await fb.F.addDoc(fb.F.collection(fb.db, 'threads'), {
      participants,
      name: String(name || '').trim() || 'Group chat',
      isGroup: true,
      createdBy: u.email,
      updatedAt: fb.F.serverTimestamp()
    });
    return ref.id;
  },
  async myThreads(cb) {
    await init();
    const u = this.currentUser();
    if (!u) return () => {};
    const q = fb.F.query(fb.F.collection(fb.db, 'threads'), fb.F.where('participants', 'array-contains', u.email));
    return fb.F.onSnapshot(q, snap => {
      const ms = t => (t.updatedAt && t.updatedAt.toMillis) ? t.updatedAt.toMillis() : 0;
      cb(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => ms(b) - ms(a)));
    }, () => {});
  },
  async onThreadMessages(tid, cb) {
    await init();
    const q = fb.F.query(fb.F.collection(fb.db, 'threads', tid, 'messages'), fb.F.orderBy('ts', 'asc'), fb.F.limit(300));
    return fb.F.onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))), () => {});
  },
  async sendDM(tid, text) {
    await init();
    const u = this.currentUser();
    if (!u) throw new Error('Sign in first.');
    await fb.F.addDoc(fb.F.collection(fb.db, 'threads', tid, 'messages'),
      { from: u.email, fromName: u.name, text: String(text), ts: fb.F.serverTimestamp() });
    await fb.F.setDoc(fb.F.doc(fb.db, 'threads', tid),
      { updatedAt: fb.F.serverTimestamp(), lastText: String(text).slice(0, 80), lastFrom: u.email }, { merge: true });
  },

  async loadSeed() {
    await init();
    for (const [name, obj] of Object.entries(SEED.settings)) await this.saveSetting(name, obj);
    for (const coll of COLLECTIONS) {
      for (const item of SEED[coll]) {
        const { id, ...data } = item;
        await fb.F.setDoc(fb.F.doc(fb.db, coll, id), data);
      }
    }
  },
  async clearContent() {
    await init();
    for (const coll of COLLECTIONS) {
      const qs = await fb.F.getDocs(fb.F.collection(fb.db, coll));
      for (const d of qs.docs) await fb.F.deleteDoc(d.ref);
    }
    for (const [name, obj] of Object.entries(FRESH)) await this.saveSetting(name, obj);
  },
  async resetAll() { throw new Error('Live mode: delete data from the Firebase console instead.'); }
};

export const store = CONFIGURED ? fireStore : localStore;
