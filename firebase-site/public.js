// Renders admin-managed content into the public pages.
// Every renderer is defensive: if the store has no data for a section (or
// anything throws), the original static markup stays visible as fallback.

import { store, normalizeBracket, bracketMatches, bracketStandings } from './data-store.js';
import { FRESH } from './seed-data.js';

// Draft data injected by the admin panel's live preview (see message listener
// at the bottom). When set, it overrides the saved data during rendering.
let PREVIEW = null;

// In live mode a missing settings doc falls back to the neutral club defaults,
// never to the static mock markup.
const setting = async name => {
  if (PREVIEW && PREVIEW.settings && PREVIEW.settings[name] !== undefined) return PREVIEW.settings[name];
  return (await store.getSetting(name)) || (store.configured ? FRESH[name] : null);
};
const listData = async coll => {
  if (PREVIEW && PREVIEW.collections && PREVIEW.collections[coll] !== undefined) return PREVIEW.collections[coll].slice();
  return store.list(coll);
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function setText(id, val) { const el = $(id); if (el && val) el.textContent = val; }

function fmtDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
function fmtD(iso, withYear) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00' : iso); // noon guards vs timezone day-shift
  if (isNaN(d)) return iso;
  const opts = { month: 'short', day: 'numeric' };
  if (withYear) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function phOr(image, alt, phLabel) {
  return image
    ? `<img src="${esc(image)}" alt="${esc(alt || '')}">`
    : `<div class="ph">${esc(phLabel || '')}</div>`;
}

const byDT = (a, b) => String(a.datetime || '').localeCompare(String(b.datetime || ''));
const byDTdesc = (a, b) => -byDT(a, b);
// Soonest first, but matches without a date sink to the end instead of the top.
const byDTLast = (a, b) => String(a.datetime || '9999').localeCompare(String(b.datetime || '9999'));
const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

const GAME_STYLE = "font-family:'Chakra Petch',sans-serif;font-size:12px;letter-spacing:.14em;color:#FDB913;display:block";

const emptyMsg = (text, span) =>
  `<p style="${span ? 'grid-column:1/-1;' : ''}color:#8B93A3;font-size:15px;padding:8px 0;margin:0">${esc(text)}</p>`;

/* ---------- shared (all pages) ---------- */

async function renderShared() {
  const site = await setting('site');
  if (!site) return null;
  const fbA = $('f-facebook'), dc = $('f-discord'), nr = $('nav-register');
  if (fbA && site.facebookUrl) fbA.href = site.facebookUrl;
  if (dc && site.discordUrl) dc.href = site.discordUrl;
  if (nr && site.registerUrl) nr.href = site.registerUrl;
  setText('footer-text', site.footerText);
  const tick = $('ticker-track');
  if (tick && Array.isArray(site.ticker)) {
    const bar = tick.closest('.ticker');
    if (site.ticker.length) {
      const seq = site.ticker.map(t => `<span>${esc(t)}</span>`).join('<span class="d">◆</span>');
      tick.innerHTML = seq + '<span class="d">◆</span>' + seq + '<span class="d">◆</span>';
      if (bar) bar.style.display = '';
    } else if (bar) {
      bar.style.display = 'none';
    }
  }
  return site;
}

/* ---------- home ---------- */

let cdTimer = null;
function startCountdown(targetIso) {
  const target = new Date(targetIso).getTime();
  if (isNaN(target)) return;
  const pad = n => String(n).padStart(2, '0');
  if (cdTimer) clearInterval(cdTimer);
  const tick = () => {
    let d = Math.max(0, target - Date.now());
    const days = Math.floor(d / 864e5); d -= days * 864e5;
    const h = Math.floor(d / 36e5); d -= h * 36e5;
    const m = Math.floor(d / 6e4); d -= m * 6e4;
    $('cd-d').textContent = pad(days);
    $('cd-h').textContent = pad(h);
    $('cd-m').textContent = pad(m);
    $('cd-s').textContent = pad(Math.floor(d / 1e3));
  };
  tick();
  cdTimer = setInterval(tick, 1000);
}

async function renderHome(site) {
  const home = await setting('home');
  if (home) {
    setText('hero-kicker', home.kicker);
    const h1 = $('hero-title');
    if (h1 && home.heroTitle) h1.innerHTML = `${esc(home.heroTitle)}<br><span>${esc(home.heroAccent || '')}</span>`;
    setText('hero-desc', home.heroText);
    const bg = $('hero-bg');
    if (bg) {
      if (home.heroImage) bg.innerHTML = `<img src="${esc(home.heroImage)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
      else if (heroBgInit) bg.innerHTML = heroBgInit;
    }
    const count = $('countdown');
    if (count) {
      if (home.countdownEnabled === false) count.style.display = 'none';
      else { count.style.display = ''; startCountdown(home.countdownTarget || '2026-08-21T18:00'); }
    }
    const g = $('home-games');
    if (g && Array.isArray(home.games) && home.games.length) {
      g.innerHTML = home.games.map(x =>
        `<div class="game">${phOr(x.image, x.name, x.name + ' art')}<div class="label">${esc(x.name)}</div></div>`
      ).join('');
    }
  }
  if (site && site.registerUrl) { const cta = $('hero-cta'); if (cta) cta.href = site.registerUrl; }

  // Facebook Live embed: appears only while an officer has it switched on.
  const liveSec = $('live-sec');
  if (liveSec) {
    const h = home || {};
    const liveUrl = String(h.liveUrl || '').trim();
    const fr = $('live-frame');
    if (h.liveOn && liveUrl) {
      setText('live-title', h.liveTitle || "We're live on Facebook");
      const fbl = $('live-fb-link'); if (fbl) fbl.href = liveUrl;
      const src = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(liveUrl) + '&show_text=false&autoplay=1';
      if (fr && fr.getAttribute('data-src') !== src) { fr.src = src; fr.setAttribute('data-src', src); }
      liveSec.hidden = false;
    } else {
      liveSec.hidden = true;
      if (fr) { fr.removeAttribute('src'); fr.removeAttribute('data-src'); }
    }
  }

  const matches = bracketMatches(await setting('bracket'))
    .filter(m => m.status !== 'final').sort(byDTLast).slice(0, 3);
  const mEl = $('home-matches');
  if (mEl) {
    mEl.innerHTML = matches.length ? matches.map(m => `
      <div class="card match-card">
        <div class="meta"><span class="g">${esc((m.game || '').toUpperCase())}</span><span class="s">${esc(m.stage)}</span></div>
        <div class="teams"><span>${esc(m.teamA)}</span><span class="vs">VS</span><span style="text-align:right">${esc(m.teamB)}</span></div>
        <div class="foot"><span>${esc(fmtDT(m.datetime) || 'Time TBA')}</span><span>${esc(m.location)}</span></div>
      </div>`).join('')
      : emptyMsg('No matches scheduled yet — check back soon.', true);
  }

  const news = (await listData('news')).sort(byDateDesc).slice(0, 3);
  const nEl = $('home-news');
  if (nEl) {
    nEl.innerHTML = news.length ? news.map(n => {
      const teaser = (n.body || '').length > 110 ? n.body.slice(0, 110).trimEnd() + '…' : (n.body || '');
      return `<a class="card news-item" href="news.html"><span class="d">${esc(fmtD(n.date).toUpperCase())}</span><span><b>${esc(n.title)}</b><small>${esc(teaser)}</small></span></a>`;
    }).join('')
      : emptyMsg('No announcements yet.');
  }

  const vids = await listData('videos');
  const link = $('home-video-link');
  if (vids.length) {
    const v = vids.find(v => v.featured) || vids[0];
    if (link) {
      link.href = v.url || 'videos.html';
      link.innerHTML = `${phOr(v.thumb, v.title, 'Video thumbnail')}<div class="play"><span>▶</span></div>`;
    }
    setText('home-video-title', v.title);
    setText('home-video-sub', v.description || 'Watch on our Facebook page');
  } else {
    if (link) { link.href = 'videos.html'; link.innerHTML = '<div class="ph">Videos coming soon</div>'; }
    const t = $('home-video-title'); if (t) t.textContent = 'No videos yet';
    const s = $('home-video-sub'); if (s) s.textContent = 'Follow our Facebook page for streams and VODs';
  }
}

/* ---------- matches ---------- */

// A blank side shows as BYE when the other side is filled, TBD otherwise;
// byes/TBDs and losers render dimmed.
function bracketSide(name, other) {
  const n = String(name || '').trim();
  return { label: n || (String(other || '').trim() ? 'BYE' : 'TBD'), dim: !n };
}

function bracketSides(m) {
  const hasScores = m.as !== '' && m.as != null && m.bs !== '' && m.bs != null && m.as !== m.bs;
  const A = bracketSide(m.a, m.b);
  const B = bracketSide(m.b, m.a);
  if (hasScores && Number(m.as) < Number(m.bs)) A.dim = true;
  if (hasScores && Number(m.bs) < Number(m.as)) B.dim = true;
  return { A, B };
}

function bracketPair(m) {
  const { A, B } = bracketSides(m);
  return `<div class="card bmatch">
    <div${A.dim ? ' class="lose"' : ''}><span>${esc(A.label)}</span><span>${esc(m.as || '—')}</span></div>
    <div${B.dim ? ' class="lose"' : ''}><span>${esc(B.label)}</span><span>${esc(m.bs || '—')}</span></div>
  </div>`;
}

function bracketFinal(name, m) {
  const { A, B } = bracketSides(m);
  return `<div class="bfinal"><span class="h">${esc(name || 'GRAND FINAL')}</span>
    <div${A.dim ? ' class="lose"' : ''}><span>${esc(A.label)}</span><span class="tbd">${esc(m.as || '—')}</span></div>
    <div${B.dim ? ' class="lose"' : ''}><span>${esc(B.label)}</span><span class="tbd">${esc(m.bs || '—')}</span></div>
  </div>`;
}

async function renderMatchesPage(site) {
  const mp = await setting('matchespage');
  if (mp) {
    setText('m-kicker', mp.kicker);
    setText('m-lede', mp.lede);
    setText('reg-title', mp.regTitle);
    setText('reg-text', mp.regText);
    const b = $('reg-btn');
    if (b) {
      if (mp.regBtn) b.textContent = mp.regBtn;
      if (site && site.registerUrl) b.href = site.registerUrl;
    }
  }

  // Schedule, results, and standings are all read straight out of the bracket.
  const br = normalizeBracket(await setting('bracket'));
  const all = bracketMatches(br);
  const up = all.filter(m => m.status !== 'final').sort(byDTLast);
  const fin = all.filter(m => m.status === 'final').sort(byDTdesc);

  const sEl = $('pane-schedule');
  if (sEl) {
    sEl.innerHTML = up.length ? up.map(m => `
      <div class="card sched"><div><span class="g">${esc((m.game || '').toUpperCase())}</span><span class="st">${esc(m.stage)}</span></div><div class="teams"><span>${esc(m.teamA)}</span><span class="vs">VS</span><span>${esc(m.teamB)}</span></div><div class="when">${esc(fmtDT(m.datetime) || 'Time TBA')}</div><div class="where">${esc(m.location)}</div></div>`).join('')
      : emptyMsg('No matches scheduled yet — check back soon.');
  }

  const rEl = $('pane-results');
  if (rEl) {
    rEl.innerHTML = fin.length ? fin.map(m => {
      const aWin = Number(m.scoreA) >= Number(m.scoreB);
      return `<div class="card res"><div><span class="g" style="${GAME_STYLE}">${esc((m.game || '').toUpperCase())}</span><span style="font-size:12px;color:#8B93A3">${esc(fmtD(m.datetime))}</span></div><div class="teams"><span${aWin ? '' : ' class="lose"'}>${esc(m.teamA)}</span><span class="score">${esc(m.scoreA)} — ${esc(m.scoreB)}</span><span${aWin ? ' class="lose"' : ''}>${esc(m.teamB)}</span></div><div class="fin">FINAL</div></div>`;
    }).join('')
      : emptyMsg('No results yet.');
  }

  const bEl = $('pane-bracket');
  if (bEl && br) {
    const rounds = (br.rounds || []).filter(r => (r.matches || []).length);
    const hasTeams = rounds.some(r => r.matches.some(m => (m.a || '').trim() || (m.b || '').trim()));
    if (hasTeams) {
      const cols = rounds.map((r, i) => i === rounds.length - 1
        ? `<div class="bcol">${r.matches.map(m => bracketFinal(r.name, m)).join('')}</div>`
        : `<div class="bcol"><div class="bhead cp">${esc(r.name || '')}</div>${r.matches.map(bracketPair).join('')}</div>`
      ).join('');
      bEl.innerHTML = `
      <div class="cp" style="margin-bottom:18px;font-size:13px;letter-spacing:.14em;color:#8B93A3">${esc(br.title || '')}</div>
      <div class="bracket">${cols}</div>`;
    } else {
      bEl.innerHTML = emptyMsg('The bracket will be posted when the tournament begins.');
    }
  }

  const stEl = $('pane-standings');
  if (stEl) {
    const rows = bracketStandings(br);
    if (rows.length) {
      stEl.innerHTML = `
      <div class="card standings">
        <div class="row head"><span>#</span><span>TEAM</span><span style="text-align:center">W</span><span style="text-align:center">L</span><span style="text-align:center">MAP +/−</span><span style="text-align:right">POINTS</span></div>
        ${rows.map((r, i) => `
        <div class="row${r.q ? ' q' : ''}"><span class="rank">${i + 1}</span><span style="font-weight:600">${esc(r.team)}</span><span class="w">${esc(r.w)}</span><span class="l">${esc(r.l)}</span><span class="diff">${esc(r.diff)}</span><span class="pts">${esc(r.pts)}</span></div>`).join('')}
        ${br && br.note ? `<div style="padding:12px 24px;font-size:12px;color:#8B93A3">${esc(br.note)}</div>` : ''}
      </div>`;
    } else {
      stEl.innerHTML = emptyMsg('Standings will appear once the bracket has teams and scores.');
    }
  }
}

/* ---------- news ---------- */

async function renderNews() {
  const posts = (await listData('news')).sort(byDateDesc);
  const el = $('news-list');
  if (!el) return;
  if (!posts.length) { el.innerHTML = emptyMsg('No news posts yet — check back soon.'); return; }
  const pinned = posts.find(p => p.pinned);
  const rest = posts.filter(p => p !== pinned);
  el.innerHTML =
    (pinned ? `
    <div class="pinned">
      <div class="meta"><span class="pin-badge">PINNED</span><span class="d">${esc(fmtD(pinned.date, true).toUpperCase())}</span></div>
      <h2>${esc(pinned.title)}</h2>
      <p>${esc(pinned.body)}</p>
      ${pinned.linkUrl ? `<a class="cp" style="font-size:13px;letter-spacing:.12em" href="${esc(pinned.linkUrl)}">${esc(pinned.linkText || 'READ MORE')} →</a>` : ''}
    </div>` : '') +
    rest.map(p => `
    <article class="card post">
      <div class="meta"><span class="tag">${esc((p.tag || '').toUpperCase())}</span><small>${esc(fmtD(p.date, true))}</small></div>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.body)}</p>
    </article>`).join('');
}

/* ---------- photos ---------- */

const TILE_SPAN = {
  big: 'grid-column:span 2;grid-row:span 2',
  wide: 'grid-column:span 2;grid-row:span 1',
  std: 'grid-column:span 1;grid-row:span 1'
};

async function renderPhotos(site) {
  const photos = (await listData('photos')).sort((a, b) => (a.order || 0) - (b.order || 0));
  const el = $('photo-gallery');
  if (el) {
    el.innerHTML = photos.length ? photos.map(p => `
      <div class="tile card" style="${TILE_SPAN[p.size] || TILE_SPAN.std}">${phOr(p.image, p.caption, p.caption)}<div class="cap"><b>${esc((p.caption || '').toUpperCase())}</b><small>${esc(p.dateLabel || '')}</small></div></div>`).join('')
      : emptyMsg('No photos yet — check back after our next event.', true);
  }
  const fbLink = $('photos-fb');
  if (fbLink && site && site.facebookUrl) fbLink.href = site.facebookUrl;
}

/* ---------- videos ---------- */

async function renderVideos(site) {
  const vids = await listData('videos');
  const follow0 = $('v-follow');
  if (follow0 && site && site.facebookUrl) follow0.href = site.facebookUrl;

  if (!vids.length) {
    const fEl = $('video-featured');
    if (fEl) {
      fEl.href = site && site.facebookUrl ? site.facebookUrl : '#';
      fEl.innerHTML = `
      <div class="thumb"><div class="ph">Videos coming soon</div></div>
      <div class="info">
        <span class="vtag">SEASIDER ESPORTS</span>
        <span class="cp" style="font-weight:700;font-size:26px;line-height:1.2;text-transform:uppercase">Videos coming soon</span>
        <span style="font-size:15px;color:#8B93A3;line-height:1.55">Follow our Facebook page for live streams, VODs, and highlights.</span>
      </div>`;
    }
    const gEl = $('video-grid');
    if (gEl) gEl.innerHTML = '';
    return;
  }

  const feat = vids.find(v => v.featured) || vids[0];
  const rest = vids.filter(v => v !== feat);

  const fEl = $('video-featured');
  if (fEl && feat) {
    fEl.href = feat.url || '#';
    fEl.innerHTML = `
      <div class="thumb">${phOr(feat.thumb, feat.title, 'Video thumbnail')}<div class="play"><span>▶</span></div><span class="badge">FEATURED</span></div>
      <div class="info">
        <span class="vtag">${esc((feat.tag || '').toUpperCase())}</span>
        <span class="cp" style="font-weight:700;font-size:28px;line-height:1.15;text-transform:uppercase">${esc(feat.title)}</span>
        <span style="font-size:15px;color:#8B93A3;line-height:1.55">${esc(feat.description || '')}</span>
        <span style="font-size:13px;color:#8B93A3">${esc([feat.duration, 'Watch on Facebook'].filter(Boolean).join(' · '))}</span>
      </div>`;
  }

  const gEl = $('video-grid');
  if (gEl) {
    gEl.innerHTML = rest.map(v => `
      <a class="card vcard" href="${esc(v.url || '#')}" target="_blank">
        <div class="thumb">${phOr(v.thumb, v.title, 'Video thumbnail')}<div class="play"><span>▶</span></div>${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ''}</div>
        <div class="info"><span class="vtag" style="font-size:11px">${esc((v.tag || '').toUpperCase())}</span><b>${esc(v.title)}</b><small>${esc([v.dateLabel, 'Facebook'].filter(Boolean).join(' · '))}</small></div>
      </a>`).join('');
  }
}

/* ---------- boot ---------- */

const heroBgInit = document.getElementById('hero-bg') ? document.getElementById('hero-bg').innerHTML : '';

async function renderAll() {
  try {
    const site = await renderShared();
    const page = document.body.dataset.page;
    if (page === 'home') await renderHome(site);
    else if (page === 'matches') await renderMatchesPage(site);
    else if (page === 'news') await renderNews();
    else if (page === 'photos') await renderPhotos(site);
    else if (page === 'videos') await renderVideos(site);
  } catch (e) {
    console.warn('Dynamic content unavailable — showing static fallback.', e);
  } finally {
    document.documentElement.classList.remove('wait');
  }
}

renderAll();

// Live preview: when this page runs inside the admin panel's preview frame,
// the panel posts draft (possibly unsaved) data; re-render with it applied.
window.addEventListener('message', e => {
  if (e.origin !== location.origin) return;
  const d = e.data;
  if (!d || d.type !== 'preview') return;
  PREVIEW = d.data || null;
  renderAll().then(() => {
    if (d.tab) {
      const btn = document.querySelector(`.tabs button[data-tab="${d.tab}"]`);
      if (btn && !btn.classList.contains('active')) btn.click();
    }
  });
});
