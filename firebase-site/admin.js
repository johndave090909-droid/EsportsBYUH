// Officer admin panel logic.

import { store, normalizeBracket } from './data-store.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

function fmtDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/* ================= image uploads ================= */

function compressImage(file, maxDim = 1400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Could not read that image file.')); };
    img.src = URL.createObjectURL(file);
  });
}

// "UPLOAD" buttons open their hidden file input
document.addEventListener('click', e => {
  const b = e.target.closest('[data-file]');
  if (b) $(b.dataset.file).click();
});

// Turns a picked image into a value for an image field: compressed data-URL in
// demo mode, or a Firebase Storage URL in live mode.
async function storeImage(file) {
  const data = await compressImage(file);
  if (store.mode !== 'firebase') {
    if (data.length > 900000) toast('Warning: that image is still large — consider a smaller photo.');
    return data;
  }
  toast('Uploading image…');
  const blob = await (await fetch(data)).blob();
  const url = await store.uploadFile('images', blob, (file.name || 'photo') + '.jpg');
  toast('Image uploaded — now press SAVE.');
  return url;
}

// Block every save while an upload is still writing its URL into the form,
// so an entry can't be saved with a half-finished image/video field.
let uploadsActive = 0;
document.addEventListener('submit', e => {
  if (uploadsActive > 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
    toast('Still uploading — wait for "uploaded" to appear, then save again.');
  }
}, true);

// file inputs write their upload's value into the input named by data-target
document.addEventListener('change', async e => {
  const f = e.target;
  if (!f.matches('input[type="file"]') || !f.files || !f.files[0]) return;
  const file = f.files[0];
  uploadsActive++;
  try {
    if (f.dataset.upload === 'videos') {
      if (store.mode !== 'firebase') throw new Error('Video uploads need live Firebase mode.');
      if (file.size > 500 * 1024 * 1024) throw new Error('Keep video files under 500 MB — for long VODs, link Facebook/YouTube instead.');
      toast('Uploading video… 0%');
      const url = await store.uploadFile('videos', file, file.name, p => toast('Uploading video… ' + p + '%'));
      $(f.dataset.target).value = url;
      toast('Video uploaded — now press SAVE VIDEO.');
    } else {
      const value = await storeImage(file);
      if (f.dataset.target) {
        $(f.dataset.target).value = value;
        const prev = $(f.dataset.target + '-prev');
        if (prev) { prev.src = value; prev.hidden = false; }
      } else if (f.classList.contains('gfile')) {
        f.closest('.game-row').querySelector('.gimg').value = value;
        toast('Image attached to game.');
      }
    }
  } catch (err) {
    toast(err.message);
  } finally {
    uploadsActive--;
    f.value = '';
  }
});

function setImgField(id, val) {
  $(id).value = val || '';
  const prev = $(id + '-prev');
  if (prev) {
    if (val) { prev.src = val; prev.hidden = false; }
    else { prev.removeAttribute('src'); prev.hidden = true; }
  }
}

/* ================= auth ================= */

let me = null;

function showLogin() {
  $('login-view').hidden = false;
  $('app-view').hidden = true;
  $('demo-note').hidden = store.mode !== 'local';
  $('live-extra').hidden = store.mode !== 'firebase';
  $('btn-google').hidden = store.mode !== 'firebase';
}

async function showApp() {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  $('user-chip').textContent = me;
  const live = store.mode === 'firebase';
  const badge = $('mode-badge');
  badge.textContent = live ? 'LIVE — FIREBASE' : 'DEMO MODE';
  badge.classList.toggle('live', live);
  await loadAll();
}

store.onAuthChange(async email => {
  if (!email) {
    me = null;
    stopChat();
    closeChatPop();
    $('chat-fab').hidden = true;
    showLogin();
    return;
  }
  if (store.mode === 'firebase' && !(await store.isOfficer(email))) return; // login() reports the error
  me = email.toLowerCase();
  showApp().catch(err => toast(err.message));
});

$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = $('login-error');
  errEl.hidden = true;
  try {
    await store.login($('login-email').value, $('login-pass').value);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

$('btn-google').addEventListener('click', async () => {
  const errEl = $('login-error');
  errEl.hidden = true;
  try {
    await store.loginGoogle();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

$('btn-forgot').addEventListener('click', async () => {
  const errEl = $('login-error');
  errEl.hidden = true;
  try {
    if (!$('login-email').value) throw new Error('Enter your email first, then press "Forgot password".');
    await store.resetPassword($('login-email').value);
    toast('Password reset email sent.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

$('btn-logout').addEventListener('click', () => store.logout());

/* ================= section nav ================= */

$('adnav').addEventListener('click', e => {
  const btn = e.target.closest('button[data-sec]');
  if (!btn) return;
  document.querySelectorAll('#adnav button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.asec').forEach(s => s.classList.toggle('active', s.id === 'sec-' + btn.dataset.sec));
  activeSec = btn.dataset.sec;
  updatePreviewTarget();
});

/* ================= home page ================= */

function gameRowHTML(g) {
  return `<div class="game-row">
    <input class="gname" placeholder="Game name" value="${esc(g.name || '')}">
    <input class="gimg" placeholder="Image URL — or upload →" value="${esc(g.image || '')}">
    <input type="file" class="gfile" accept="image/*" hidden>
    <button type="button" class="btn-sm g-upload">UPLOAD</button>
    <button type="button" class="btn-sm danger g-del" style="grid-column:auto">✕</button>
  </div>`;
}

$('games-list').addEventListener('click', e => {
  if (e.target.closest('.g-upload')) e.target.closest('.game-row').querySelector('.gfile').click();
  if (e.target.closest('.g-del')) e.target.closest('.game-row').remove();
});
$('btn-add-game').addEventListener('click', () => {
  $('games-list').insertAdjacentHTML('beforeend', gameRowHTML({}));
});

async function refreshHome() {
  const home = await store.getSetting('home') || {};
  $('h-kicker').value = home.kicker || '';
  $('h-title').value = home.heroTitle || '';
  $('h-accent').value = home.heroAccent || '';
  $('h-text').value = home.heroText || '';
  setImgField('h-image', home.heroImage);
  $('h-cd-on').checked = home.countdownEnabled !== false;
  $('h-cd-target').value = (home.countdownTarget || '').slice(0, 16);
  $('h-live-on').checked = home.liveOn === true;
  $('h-live-url').value = home.liveUrl || '';
  $('h-live-title').value = home.liveTitle || '';
  $('games-list').innerHTML = (home.games || []).map(gameRowHTML).join('');
}

function collectHomeForm() {
  return {
    kicker: $('h-kicker').value.trim(),
    heroTitle: $('h-title').value.trim(),
    heroAccent: $('h-accent').value.trim(),
    heroText: $('h-text').value.trim(),
    heroImage: $('h-image').value.trim(),
    countdownEnabled: $('h-cd-on').checked,
    countdownTarget: $('h-cd-target').value,
    liveOn: $('h-live-on').checked,
    liveUrl: $('h-live-url').value.trim(),
    liveTitle: $('h-live-title').value.trim(),
    games: [...document.querySelectorAll('#games-list .game-row')]
      .map(r => ({ name: r.querySelector('.gname').value.trim(), image: r.querySelector('.gimg').value.trim() }))
      .filter(g => g.name)
  };
}

$('form-home').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const obj = collectHomeForm();
    if (obj.liveOn && !obj.liveUrl) { toast('Paste the Facebook video link first, or untick "WE\'RE LIVE".'); return; }
    await store.saveSetting('home', obj);
    toast('Home page saved.');
  } catch (err) { toast(err.message); }
});

/* ================= matches page text ================= */
// Schedule, results, and standings all derive from the bracket — this section
// only edits the page's intro text and register banner.

async function refreshMatchpage() {
  const mp = await store.getSetting('matchespage') || {};
  $('mp-kicker').value = mp.kicker || '';
  $('mp-lede').value = mp.lede || '';
  $('mp-regtitle').value = mp.regTitle || '';
  $('mp-regtext').value = mp.regText || '';
  $('mp-regbtn').value = mp.regBtn || '';
  schedulePreview();
}

function collectMatchpageForm() {
  return {
    kicker: $('mp-kicker').value.trim(),
    lede: $('mp-lede').value.trim(),
    regTitle: $('mp-regtitle').value.trim(),
    regText: $('mp-regtext').value.trim(),
    regBtn: $('mp-regbtn').value.trim()
  };
}

$('form-matchpage').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await store.saveSetting('matchespage', collectMatchpageForm());
    toast('Page text saved.');
  } catch (err) { toast(err.message); }
});

/* ================= bracket ================= */

// One bracket match card: two team rows with a score slot, styled like the
// public bracket so officers edit what visitors will see.
function bracketRowHTML(m) {
  return `<div class="bmatch-edit">
    <button type="button" class="m-del" title="Remove this match">✕</button>
    <div class="trow"><input class="ba" placeholder="Team" value="${esc(m.a || '')}"><input class="bas" placeholder="–" value="${esc(m.as || '')}"></div>
    <div class="trow"><input class="bb" placeholder="Team" value="${esc(m.b || '')}"><input class="bbs" placeholder="–" value="${esc(m.bs || '')}"></div>
    <div class="mrow"><input type="datetime-local" class="bwhen" title="Date &amp; time" value="${esc((m.when || '').slice(0, 16))}"><input class="bwhere" placeholder="Location" value="${esc(m.where || '')}"></div>
  </div>`;
}

function roundColHTML(r) {
  return `<div class="bcol-edit">
    <div class="round-head"><input class="rname" value="${esc(r.name || '')}" placeholder="ROUND NAME"><button type="button" class="btn-sm danger r-del" title="Remove this round">✕</button></div>
    <div class="rmatches">${(r.matches || []).map(bracketRowHTML).join('')}</div>
    <button type="button" class="btn-sm r-add">+ MATCH</button>
  </div>`;
}

function renderBracketEditor(rounds) {
  $('b-rounds').innerHTML = rounds.map(roundColHTML).join('');
}

async function refreshBracket() {
  const br = normalizeBracket(await store.getSetting('bracket')) || {};
  $('b-title').value = br.title || '';
  $('b-game').value = br.game || '';
  $('b-note').value = br.note || '';
  const home = await store.getSetting('home');
  $('game-options').innerHTML = (((home && home.games) || []).map(g => g.name).filter(Boolean))
    .map(g => `<option value="${esc(g)}"></option>`).join('');
  const rounds = (br.rounds || []).length ? br.rounds
    : [{ name: 'SEMIFINALS', matches: [{}, {}] }, { name: 'GRAND FINAL', matches: [{}] }];
  renderBracketEditor(rounds);
}

$('b-rounds').addEventListener('click', e => {
  if (e.target.closest('.r-del')) {
    if (confirm('Remove this round and its matches?')) e.target.closest('.bcol-edit').remove();
  } else if (e.target.closest('.r-add')) {
    e.target.closest('.bcol-edit').querySelector('.rmatches').insertAdjacentHTML('beforeend', bracketRowHTML({}));
  } else if (e.target.closest('.m-del')) {
    e.target.closest('.bmatch-edit').remove();
  }
});

$('b-add-round').addEventListener('click', () => {
  $('b-rounds').insertAdjacentHTML('beforeend', roundColHTML({ name: '', matches: [{}] }));
});

// Builds single-elimination rounds for any team count; odd counts get BYEs.
$('b-build').addEventListener('click', () => {
  const n = parseInt($('b-teams').value, 10);
  if (!n || n < 2) { toast('Enter the number of teams (2 or more) first.'); return; }
  if (n > 64) { toast('Keep it to 64 teams or fewer.'); return; }
  if ($('b-rounds').children.length && !confirm(`Replace the current bracket layout with a fresh one for ${n} teams?`)) return;
  let size = 2;
  while (size < n) size *= 2;
  const byes = size - n;
  const rounds = [];
  for (let m = size / 2; m >= 1; m /= 2) {
    rounds.push({
      name: m === 1 ? 'GRAND FINAL' : m === 2 ? 'SEMIFINALS' : m === 4 ? 'QUARTERFINALS' : 'ROUND OF ' + m * 2,
      matches: Array.from({ length: m }, () => ({ a: '', as: '', b: '', bs: '' }))
    });
  }
  for (let i = 0; i < byes; i++) rounds[0].matches[rounds[0].matches.length - 1 - i].b = 'BYE';
  renderBracketEditor(rounds);
  toast(`Built a ${size}-slot bracket${byes ? ` with ${byes} bye${byes === 1 ? '' : 's'}` : ''} — type the team names in, then SAVE BRACKET.`);
});

function collectBracketForm() {
  const rounds = [...document.querySelectorAll('#b-rounds .bcol-edit')].map(col => ({
    name: col.querySelector('.rname').value.trim(),
    matches: [...col.querySelectorAll('.bmatch-edit')].map(card => ({
      a: card.querySelector('.ba').value.trim(),
      as: card.querySelector('.bas').value.trim(),
      b: card.querySelector('.bb').value.trim(),
      bs: card.querySelector('.bbs').value.trim(),
      when: card.querySelector('.bwhen').value,
      where: card.querySelector('.bwhere').value.trim()
    }))
  })).filter(r => r.matches.length);
  return {
    title: $('b-title').value.trim(),
    game: $('b-game').value.trim(),
    note: $('b-note').value.trim(),
    rounds
  };
}

$('form-bracket').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await store.saveSetting('bracket', collectBracketForm());
    toast('Bracket saved.');
  } catch (err) { toast(err.message); }
});

/* Standings are computed from the bracket — there is no separate editor. */

/* ================= news ================= */

let newsCache = [];

async function refreshNews() {
  newsCache = (await store.list('news')).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!$('n-date').value) $('n-date').value = new Date().toISOString().slice(0, 10);
  $('news-admin-list').innerHTML = newsCache.map(n => `
    <div class="item-row">
      ${n.pinned ? '<span class="tag-chip">PINNED</span>' : ''}
      <div class="item-main"><b>${esc(n.title)}</b><small>${esc((n.tag || '').toUpperCase())} · ${esc(n.date)}</small></div>
      <button type="button" class="btn-sm" data-act="edit" data-id="${esc(n.id)}">EDIT</button>
      <button type="button" class="btn-sm danger" data-act="del" data-id="${esc(n.id)}">DELETE</button>
    </div>`).join('') || '<p class="hint">No posts yet.</p>';
  schedulePreview();
}

function resetNewsForm() {
  $('form-news').reset();
  $('n-id').value = '';
  $('n-date').value = new Date().toISOString().slice(0, 10);
  $('news-form-title').textContent = 'ADD POST';
  $('n-cancel').hidden = true;
}
$('n-cancel').addEventListener('click', resetNewsForm);

$('news-admin-list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const n = newsCache.find(x => x.id === btn.dataset.id);
  if (!n) return;
  if (btn.dataset.act === 'del') {
    if (!confirm(`Delete post "${n.title}"?`)) return;
    await store.remove('news', n.id);
    toast('Post deleted.');
    refreshNews();
  } else {
    $('n-id').value = n.id;
    $('n-title').value = n.title || '';
    $('n-tag').value = n.tag || '';
    $('n-date').value = n.date || '';
    $('n-body').value = n.body || '';
    $('n-pinned').checked = !!n.pinned;
    $('n-linktext').value = n.linkText || '';
    $('n-linkurl').value = n.linkUrl || '';
    $('news-form-title').textContent = 'EDIT POST';
    $('n-cancel').hidden = false;
    $('form-news').scrollIntoView({ behavior: 'smooth' });
  }
});

function collectNewsForm() {
  return {
    title: $('n-title').value.trim(),
    tag: $('n-tag').value.trim(),
    date: $('n-date').value,
    body: $('n-body').value.trim(),
    pinned: $('n-pinned').checked,
    linkText: $('n-linktext').value.trim(),
    linkUrl: $('n-linkurl').value.trim()
  };
}

$('form-news').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const obj = collectNewsForm();
    const id = $('n-id').value;
    let savedId = id;
    if (id) await store.update('news', id, obj);
    else savedId = await store.add('news', obj);
    if (obj.pinned) {
      for (const other of newsCache) {
        if (other.id !== savedId && other.pinned) await store.update('news', other.id, { ...other, pinned: false });
      }
    }
    resetNewsForm();
    toast('Post saved.');
    refreshNews();
  } catch (err) { toast(err.message); }
});

/* ================= photos ================= */

let photoCache = [];

function photoThumb(p) {
  return p.image ? `<img class="thumb-sm" src="${esc(p.image)}" alt="">` : '<span class="ph-sm">NO IMG</span>';
}

const SIZE_LABEL = { big: 'Large 2×2', wide: 'Wide 2×1', std: 'Standard' };

async function refreshPhotos() {
  photoCache = (await store.list('photos')).sort((a, b) => (a.order || 0) - (b.order || 0));
  $('photo-admin-list').innerHTML = photoCache.map((p, i) => `
    <div class="item-row">
      ${photoThumb(p)}
      <div class="item-main"><b>${esc(p.caption)}</b><small>${esc(p.dateLabel || '')} · ${SIZE_LABEL[p.size] || 'Standard'}</small></div>
      <button type="button" class="btn-sm" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="btn-sm" data-act="down" data-i="${i}" ${i === photoCache.length - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="btn-sm" data-act="edit" data-i="${i}">EDIT</button>
      <button type="button" class="btn-sm danger" data-act="del" data-i="${i}">DELETE</button>
    </div>`).join('') || '<p class="hint">No photos yet.</p>';
  schedulePreview();
}

function resetPhotoForm() {
  $('form-photo').reset();
  $('p-id').value = '';
  setImgField('p-image', '');
  $('photo-form-title').textContent = 'ADD PHOTO';
  $('p-cancel').hidden = true;
}
$('p-cancel').addEventListener('click', resetPhotoForm);

$('photo-admin-list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const p = photoCache[i];
  if (!p) return;
  const act = btn.dataset.act;
  if (act === 'del') {
    if (!confirm(`Delete photo "${p.caption}"?`)) return;
    await store.remove('photos', p.id);
    toast('Photo deleted.');
    refreshPhotos();
  } else if (act === 'up' || act === 'down') {
    const j = act === 'up' ? i - 1 : i + 1;
    const other = photoCache[j];
    if (!other) return;
    const tmp = p.order; p.order = other.order; other.order = tmp;
    await store.update('photos', p.id, p);
    await store.update('photos', other.id, other);
    refreshPhotos();
  } else {
    $('p-id').value = p.id;
    $('p-caption').value = p.caption || '';
    $('p-date').value = p.dateLabel || '';
    $('p-size').value = p.size || 'std';
    setImgField('p-image', p.image);
    $('photo-form-title').textContent = 'EDIT PHOTO';
    $('p-cancel').hidden = false;
    $('form-photo').scrollIntoView({ behavior: 'smooth' });
  }
});

function collectPhotoForm() {
  const existing = photoCache.find(x => x.id === $('p-id').value);
  return {
    caption: $('p-caption').value.trim(),
    dateLabel: $('p-date').value.trim(),
    size: $('p-size').value,
    image: $('p-image').value.trim(),
    order: existing ? existing.order : (photoCache.length ? Math.max(...photoCache.map(x => x.order || 0)) + 1 : 1)
  };
}

$('form-photo').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const id = $('p-id').value;
    const obj = collectPhotoForm();
    if (!obj.image) { toast('Add the picture first: IMAGE → UPLOAD, wait for "Image uploaded", then save.'); return; }
    if (id) await store.update('photos', id, obj);
    else await store.add('photos', obj);
    resetPhotoForm();
    toast('Photo saved.');
    refreshPhotos();
  } catch (err) { toast(err.message); }
});

/* ================= videos ================= */

let videoCache = [];

async function refreshVideos() {
  videoCache = await store.list('videos');
  $('video-admin-list').innerHTML = videoCache.map(v => `
    <div class="item-row">
      ${v.thumb ? `<img class="thumb-sm" src="${esc(v.thumb)}" alt="">` : '<span class="ph-sm">NO IMG</span>'}
      ${v.featured ? '<span class="tag-chip">FEATURED</span>' : ''}
      <div class="item-main"><b>${esc(v.title)}</b><small>${esc((v.tag || '').toUpperCase())} · ${esc(v.duration || '')} · ${esc(v.dateLabel || '')}</small></div>
      <button type="button" class="btn-sm" data-act="edit" data-id="${esc(v.id)}">EDIT</button>
      <button type="button" class="btn-sm danger" data-act="del" data-id="${esc(v.id)}">DELETE</button>
    </div>`).join('') || '<p class="hint">No videos yet.</p>';
  schedulePreview();
}

function resetVideoForm() {
  $('form-video').reset();
  $('v-id').value = '';
  setImgField('v-thumb', '');
  $('video-form-title').textContent = 'ADD VIDEO';
  $('v-cancel').hidden = true;
}
$('v-cancel').addEventListener('click', resetVideoForm);

$('video-admin-list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const v = videoCache.find(x => x.id === btn.dataset.id);
  if (!v) return;
  if (btn.dataset.act === 'del') {
    if (!confirm(`Delete video "${v.title}"?`)) return;
    await store.remove('videos', v.id);
    toast('Video deleted.');
    refreshVideos();
  } else {
    $('v-id').value = v.id;
    $('v-title').value = v.title || '';
    $('v-tag').value = v.tag || '';
    $('v-url').value = v.url || '';
    $('v-duration').value = v.duration || '';
    $('v-date').value = v.dateLabel || '';
    $('v-desc').value = v.description || '';
    $('v-featured').checked = !!v.featured;
    setImgField('v-thumb', v.thumb);
    $('video-form-title').textContent = 'EDIT VIDEO';
    $('v-cancel').hidden = false;
    $('form-video').scrollIntoView({ behavior: 'smooth' });
  }
});

function collectVideoForm() {
  return {
    title: $('v-title').value.trim(),
    tag: $('v-tag').value.trim(),
    url: $('v-url').value.trim(),
    duration: $('v-duration').value.trim(),
    dateLabel: $('v-date').value.trim(),
    description: $('v-desc').value.trim(),
    featured: $('v-featured').checked,
    thumb: $('v-thumb').value.trim()
  };
}

$('form-video').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const obj = collectVideoForm();
    const id = $('v-id').value;
    let savedId = id;
    if (id) await store.update('videos', id, obj);
    else savedId = await store.add('videos', obj);
    if (obj.featured) {
      for (const other of videoCache) {
        if (other.id !== savedId && other.featured) await store.update('videos', other.id, { ...other, featured: false });
      }
    }
    resetVideoForm();
    toast('Video saved.');
    refreshVideos();
  } catch (err) { toast(err.message); }
});

/* ================= site settings ================= */

async function refreshSite() {
  const site = await store.getSetting('site') || {};
  $('s-ticker').value = (site.ticker || []).join('\n');
  $('s-facebook').value = site.facebookUrl || '';
  $('s-discord').value = site.discordUrl || '';
  $('s-register').value = site.registerUrl || '';
  $('s-footer').value = site.footerText || '';

  const live = store.mode === 'firebase';
  $('btn-reset').hidden = live;
  $('mode-info').textContent = live
    ? 'Live mode: content is stored in Firebase and visible to everyone. "Load sample content" overwrites the live content with the starter content.'
    : 'Demo mode: content and logins are stored in this browser only. To go live for everyone, follow ADMIN-SETUP.md (create a free Firebase project and paste its config into firebase-config.js).';
}

function collectSiteForm() {
  return {
    ticker: $('s-ticker').value.split('\n').map(s => s.trim()).filter(Boolean),
    facebookUrl: $('s-facebook').value.trim(),
    discordUrl: $('s-discord').value.trim(),
    registerUrl: $('s-register').value.trim(),
    footerText: $('s-footer').value.trim()
  };
}

$('form-site').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await store.saveSetting('site', collectSiteForm());
    toast('Settings saved.');
  } catch (err) { toast(err.message); }
});

$('btn-seed').addEventListener('click', async () => {
  if (!confirm('Load the sample content? This overwrites current content (officer accounts are kept).')) return;
  try {
    await store.loadSeed();
    toast('Sample content loaded.');
    await loadAll();
  } catch (err) { toast(err.message); }
});

$('btn-clear').addEventListener('click', async () => {
  if (!confirm('Delete ALL content — matches, news, photos, videos, bracket, standings — and reset page text to a clean club-branded starting point? Officer accounts are kept. You can reload the sample content any time.')) return;
  try {
    await store.clearContent();
    toast('All mock content cleared — the site is a blank slate.');
    await loadAll();
  } catch (err) { toast(err.message); }
});

$('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset EVERYTHING? This wipes all demo content and officer accounts in this browser and restores the defaults.')) return;
  await store.resetAll();
  location.reload();
});

/* ================= officers ================= */

async function refreshOfficers() {
  const live = store.mode === 'firebase';
  $('o-pass-wrap').hidden = live;
  $('form-mypass').hidden = live;
  $('off-hint').textContent = live
    ? 'Officers listed here can sign in and edit the site — accounts can only be created from this page, never from the login screen. Adding someone creates their account and emails them a link to set their password. If their email is a Google account, they can skip the email and just press "Continue with Google".'
    : 'Demo mode: officer accounts live in this browser. Add an officer with an email and password they can sign in with.';
  const officers = await store.listOfficers();
  $('officer-list').innerHTML = officers.map(o => `
    <div class="item-row">
      <div class="item-main"><b>${esc(o.name || '(no name)')}</b><small>${esc(o.email)}</small></div>
      ${o.email.toLowerCase() === me ? '<span class="tag-chip">YOU</span>'
        : `<button type="button" class="btn-sm danger" data-email="${esc(o.email)}">REMOVE</button>`}
    </div>`).join('');
}

$('officer-list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-email]');
  if (!btn) return;
  if (!confirm(`Remove officer ${btn.dataset.email}? They will no longer be able to sign in.`)) return;
  try {
    await store.removeOfficer(btn.dataset.email);
    toast('Officer removed.');
    refreshOfficers();
  } catch (err) { toast(err.message); }
});

$('form-officer').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const result = await store.addOfficer({
      name: $('o-name').value.trim(),
      email: $('o-email').value.trim(),
      password: $('o-pass').value
    });
    $('form-officer').reset();
    toast(result === 'created'
      ? 'Officer added — they got an email with a link to set their password.'
      : result === 'existing'
        ? 'Officer added — they already have an account and can sign in now.'
        : 'Officer added.');
    refreshOfficers();
  } catch (err) { toast(err.message); }
});

$('form-mypass').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await store.changePassword(me, $('my-pass').value);
    $('form-mypass').reset();
    toast('Password changed.');
  } catch (err) { toast(err.message); }
});

/* ================= officer chat & inbox ================= */

let unsubRoom = null, unsubThreads = null, unsubDM = null;
let activeTid = null;
let chatThreads = [];
let chatOpen = false;
const CHAT_SEEN = 'seasiderChatSeen';

function markChatSeen() {
  localStorage.setItem(CHAT_SEEN, String(Date.now()));
  $('chat-dot').hidden = true;
}
// Light a badge dot on the chat bubble when something arrives while closed.
function maybeChatDot(tsMillis, fromMe) {
  if (fromMe) return;
  if (chatOpen) { markChatSeen(); return; }
  if (tsMillis > Number(localStorage.getItem(CHAT_SEEN) || 0)) $('chat-dot').hidden = false;
}

function openChatPop() {
  chatOpen = true;
  $('chat-pop').hidden = false;
  markChatSeen();
}
function closeChatPop() {
  chatOpen = false;
  $('chat-pop').hidden = true;
}

$('chat-fab').addEventListener('click', () => { if (chatOpen) closeChatPop(); else openChatPop(); });
$('chat-close').addEventListener('click', closeChatPop);
document.addEventListener('click', e => {
  if (!chatOpen) return;
  if (e.target.closest('#chat-pop') || e.target.closest('#chat-fab')) return;
  closeChatPop();
});

function fmtTs(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'sending…';
}
function scrollBottom(el) { el.scrollTop = el.scrollHeight; }
function otherOf(t) { return (t.participants || []).find(p => p !== me) || me; }
// Display name of a thread: its group name, or the other person for a DM.
function nameOf(t) { return t.isGroup ? (t.name || 'Group chat') : otherOf(t); }
function setDMHead(t) {
  $('dm-head-name').textContent = nameOf(t);
  $('dm-head-mem').textContent = t.isGroup ? (t.participants || []).join(', ') : '';
  $('dm-head-mem').hidden = !t.isGroup;
}

function stopChat() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (unsubThreads) { unsubThreads(); unsubThreads = null; }
  if (unsubDM) { unsubDM(); unsubDM = null; }
  activeTid = null;
}

async function startChat() {
  const live = store.mode === 'firebase';
  $('chat-fab').hidden = !live;
  if (!live) return;
  stopChat();
  unsubRoom = await store.onChat(renderRoom);
  unsubThreads = await store.myThreads(renderChatThreads);
  const officers = await store.listOfficers();
  const others = officers.filter(o => o.email.toLowerCase() !== me);
  $('nt-officer').innerHTML = others
    .map(o => `<option value="${esc(o.email)}">${esc(o.name || o.email)}</option>`).join('')
    || '<option value="">(no other officers yet)</option>';
  $('ng-members').innerHTML = others
    .map(o => `<label><input type="checkbox" value="${esc(o.email)}"> ${esc(o.name || o.email)}</label>`).join('')
    || '<div class="chat-note" style="padding:0">No other officers yet — add them on the Officers page first.</div>';
  showInboxList();
}

function showInboxList() {
  $('inbox-list-view').classList.add('active');
  $('inbox-dm-view').classList.remove('active');
  if (unsubDM) { unsubDM(); unsubDM = null; }
  activeTid = null;
  renderChatThreads(chatThreads);
}

function renderRoom(msgs) {
  $('room-list').innerHTML = msgs.map(m => `
    <div class="msg${m.email === me ? ' mine' : ''}">
      <div class="who">${esc(m.name || m.email)} <small>${esc(fmtTs(m.ts))}</small> <button type="button" class="del" data-del="${esc(m.id)}">delete</button></div>
      <div class="txt">${esc(m.text)}</div>
    </div>`).join('') || '<div class="chat-note">No messages yet — say aloha!</div>';
  scrollBottom($('room-list'));
  const last = msgs[msgs.length - 1];
  if (last && last.ts && last.ts.toMillis) maybeChatDot(last.ts.toMillis(), last.email === me);
}

function renderChatThreads(threads) {
  chatThreads = threads;
  $('thread-list').innerHTML = threads.map(t => `
    <div class="thread-item${t.id === activeTid ? ' active' : ''}" data-tid="${esc(t.id)}">
      <b>${t.isGroup ? '👥 ' : ''}${esc(nameOf(t))}</b>
      <small>${esc(t.lastText || 'No messages yet')}</small>
    </div>`).join('') || '<div class="chat-note">No conversations yet — pick an officer above.</div>';
  // Keep the open conversation's header fresh (covers just-created threads).
  const at = threads.find(x => x.id === activeTid);
  if (at) setDMHead(at);
  const t0 = threads[0];
  if (t0 && t0.updatedAt && t0.updatedAt.toMillis) maybeChatDot(t0.updatedAt.toMillis(), t0.lastFrom === me);
}

function renderDM(msgs) {
  $('dm-list').innerHTML = msgs.map(m => `
    <div class="msg${m.from === me ? ' mine' : ''}">
      <div class="who">${esc(m.fromName || m.from)} <small>${esc(fmtTs(m.ts))}</small></div>
      <div class="txt">${esc(m.text)}</div>
    </div>`).join('') || '<div class="chat-note">No messages in this conversation yet.</div>';
  scrollBottom($('dm-list'));
}

async function openDM(tid) {
  activeTid = tid;
  const t = chatThreads.find(x => x.id === tid);
  if (t) setDMHead(t);
  else { $('dm-head-name').textContent = 'Conversation'; $('dm-head-mem').textContent = ''; $('dm-head-mem').hidden = true; }
  $('inbox-list-view').classList.remove('active');
  $('inbox-dm-view').classList.add('active');
  if (unsubDM) { unsubDM(); unsubDM = null; }
  renderDM([]);
  unsubDM = await store.onThreadMessages(tid, renderDM);
}

$('dm-back').addEventListener('click', showInboxList);

document.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-ctab]').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.ctab').forEach(p => p.classList.toggle('active', p.id === 'ctab-' + b.dataset.ctab));
}));

$('room-form').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('room-input').value.trim();
  if (!t) return;
  $('room-input').value = '';
  try { await store.sendChat(t); } catch (err) { toast(err.message); }
});

$('room-list').addEventListener('click', async e => {
  const b = e.target.closest('button[data-del]');
  if (!b) return;
  if (!confirm('Delete this message?')) return;
  try { await store.deleteChat(b.dataset.del); } catch (err) { toast(err.message); }
});

$('new-thread').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    if (!$('nt-officer').value) throw new Error('No other officers to message yet.');
    const tid = await store.openThread($('nt-officer').value);
    openDM(tid);
  } catch (err) { toast(err.message); }
});

$('ng-open').addEventListener('click', () => { $('new-group').hidden = !$('new-group').hidden; });
$('ng-cancel').addEventListener('click', () => { $('new-group').hidden = true; });

$('new-group').addEventListener('submit', async e => {
  e.preventDefault();
  const picked = [...document.querySelectorAll('#ng-members input:checked')].map(c => c.value);
  try {
    if (!picked.length) throw new Error('Tick at least one officer to put in the group.');
    const tid = await store.createGroup($('ng-name').value, picked);
    $('new-group').reset();
    $('new-group').hidden = true;
    openDM(tid);
  } catch (err) { toast(err.message); }
});

$('thread-list').addEventListener('click', e => {
  const el = e.target.closest('[data-tid]');
  if (el) openDM(el.dataset.tid);
});

$('dm-form').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('dm-input').value.trim();
  if (!t || !activeTid) return;
  $('dm-input').value = '';
  try { await store.sendDM(activeTid, t); } catch (err) { toast(err.message); }
});

/* ================= live preview ================= */
// An iframe below the sections shows the real public page. Current form state
// — including unsaved edits — is streamed into it and rendered by public.js.

const PREVIEW_PAGE = {
  home: '/home', matches: '/matches', bracket: '/matches',
  news: '/news', photos: '/photos',
  videos: '/videos', site: '/home', officers: '/home'
};
const NO_PREVIEW = { officers: true };
const PREVIEW_TAB = { matches: 'schedule', bracket: 'bracket' };

let activeSec = 'home';
let formsReady = false;
let previewTimer = null;

function updatePreviewTarget() {
  const wrap = $('preview-wrap');
  if (!wrap) return;
  wrap.style.display = NO_PREVIEW[activeSec] ? 'none' : '';
  const frame = $('preview-frame');
  const page = PREVIEW_PAGE[activeSec] || '/home';
  if (frame.getAttribute('src') !== page) frame.setAttribute('src', page); // its load event re-sends the preview
  else schedulePreview();
}

function draftedList(cache, editIdField, draft, hasContent) {
  if (!hasContent) return cache.slice();
  const editId = $(editIdField).value;
  const list = cache.filter(x => x.id !== editId);
  list.push({ ...draft, id: editId || '__draft__' });
  return list;
}

function buildPreviewData() {
  const newsDraft = collectNewsForm();
  const photoDraft = collectPhotoForm();
  const videoDraft = collectVideoForm();

  let news = draftedList(newsCache, 'n-id', newsDraft, !!newsDraft.title);
  if (newsDraft.title && newsDraft.pinned) news = news.map(n => n.id !== ($('n-id').value || '__draft__') && n.pinned ? { ...n, pinned: false } : n);
  let videos = draftedList(videoCache, 'v-id', videoDraft, !!videoDraft.title);
  if (videoDraft.title && videoDraft.featured) videos = videos.map(v => v.id !== ($('v-id').value || '__draft__') && v.featured ? { ...v, featured: false } : v);

  return {
    settings: {
      site: collectSiteForm(),
      home: collectHomeForm(),
      matchespage: collectMatchpageForm(),
      bracket: collectBracketForm()
    },
    collections: {
      news,
      photos: draftedList(photoCache, 'p-id', photoDraft, !!(photoDraft.caption || photoDraft.image)),
      videos
    }
  };
}

function sendPreview() {
  if (!formsReady || !me) return;
  const frame = $('preview-frame');
  if (!frame || !frame.contentWindow) return;
  try {
    frame.contentWindow.postMessage(
      { type: 'preview', data: buildPreviewData(), tab: PREVIEW_TAB[activeSec] },
      location.origin
    );
  } catch (err) { console.warn('Preview update failed', err); }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(sendPreview, 350);
}

document.addEventListener('input', e => { if (e.target.closest('#app-view main')) schedulePreview(); });
document.addEventListener('change', e => { if (e.target.closest('#app-view main')) schedulePreview(); });
document.addEventListener('click', e => { if (e.target.closest('#app-view main')) schedulePreview(); });
$('preview-frame').addEventListener('load', schedulePreview);

$('preview-toggle').addEventListener('click', () => {
  const frame = $('preview-frame');
  frame.hidden = !frame.hidden;
  $('preview-toggle').textContent = frame.hidden ? 'SHOW' : 'HIDE';
});

/* ================= load everything ================= */

async function loadAll() {
  await Promise.all([
    refreshHome(), refreshMatchpage(), refreshBracket(),
    refreshNews(), refreshPhotos(), refreshVideos(), refreshSite(), refreshOfficers()
  ]);
  formsReady = true;
  updatePreviewTarget();
  startChat().catch(err => console.warn('Chat unavailable', err));
}
