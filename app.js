import { makeDefaultHouse, PALETTE, PLAYER_EMOJI, ROOM_EMOJI, RANKS, SPECIAL_BADGES } from './data.js';
import { openStore } from './store.js';

// ───────────── device prefs & household key ─────────────
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const dev = Object.assign({ me: null, sound: true, haptics: true, swipeHint: true }, JSON.parse(lsGet('gl_dev') || '{}'));
const saveDev = () => lsSet('gl_dev', JSON.stringify(dev));

const params = new URLSearchParams(location.search);
let KEY = params.get('h') || lsGet('gl_key');
if (KEY && !/^[A-Za-z0-9]{12,40}$/.test(KEY)) KEY = null;
if (params.has('p') && dev.me === null && /^[01]$/.test(params.get('p'))) { dev.me = +params.get('p'); saveDev(); }
function pinUrl() {
  // keep the household key in the URL so "Add to Home Screen" carries it into the installed app
  if (!KEY) return;
  lsSet('gl_key', KEY);
  const u = new URL(location.href);
  u.searchParams.set('h', KEY);
  if (dev.me !== null) u.searchParams.set('p', dev.me); else u.searchParams.delete('p');
  history.replaceState(null, '', u.pathname + u.search);
}
const newKey = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const a = new Uint32Array(22); crypto.getRandomValues(a); return Array.from(a, (x) => c[x % c.length]).join(''); };
const inviteLink = (p) => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('h', KEY); if (p !== undefined) u.searchParams.set('p', p); return u.toString(); };

// ───────────── state ─────────────
let house = null;
let store = null;
let sync = 'connecting';
const ui = { tab: 'round', view: null, filter: 'mine', hideDone: false, taskSeg: 'recurring', badgeP: 0 };
const NOW = () => new Date();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, el = document) => el.querySelector(s);

// ───────────── rounds & months ─────────────
const epochAbs = () => { const [y, m] = (house?.rules?.epoch || '2026-11').split('-').map(Number); return y * 12 + (m - 1); };
const absOf = (i) => epochAbs() + i;
const keyOf = (i) => { const t = absOf(i); return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const dateOf = (i) => { const t = absOf(i); return new Date(Math.floor(t / 12), t % 12, 1); };
const monthName = (i, opt = { month: 'long' }) => dateOf(i).toLocaleString('en-US', opt);
const curRound = () => { const n = NOW(); return Math.max(0, n.getFullYear() * 12 + n.getMonth() - epochAbs()); };
const seasonOf = (i) => Math.floor(i / 12);
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const P = (p) => house.players[p];
const pName = (p) => esc(P(p).name);
const FREQ = { 1: 'monthly', 2: 'every 2 mo', 3: 'every 3 mo', 6: 'every 6 mo', 12: 'yearly' };
const room = (r) => house.rooms[r] || { n: 'Somewhere', e: '📦', o: 99 };
const roomsSorted = () => Object.entries(house.rooms).sort((a, b) => a[1].o - b[1].o);

function dueTasks(i) {
  const out = [];
  for (const [id, t] of Object.entries(house.tasks || {})) {
    if ((t.since || 0) > i) continue;
    if ((((i - t.off) % t.f) + t.f) % t.f === 0) out.push({ id, t, kind: 'rec' });
  }
  const k = keyOf(i);
  for (const [id, t] of Object.entries(house.oneoffs || {})) if (t.m === k) out.push({ id, t, kind: 'one' });
  return out;
}
function plan(i) {
  const d = dueTasks(i);
  const tol = house.rules.tolerance ?? 2;
  const tot = [0, 0], base = {};
  d.filter((x) => x.kind === 'one' && (x.t.who === 0 || x.t.who === 1)).forEach((x) => { base[x.id] = x.t.who; tot[x.t.who] += x.t.p; });
  d.filter((x) => base[x.id] === undefined)
    .sort((a, b) => b.t.p - a.t.p || (a.id < b.id ? -1 : 1))
    .forEach((x) => {
      const occ = x.kind === 'rec' ? Math.floor((i - x.t.off) / x.t.f) : 0;
      let p = (((occ + hash(x.id)) % 2) + 2) % 2;
      const o = 1 - p, cp = Math.abs(tot[p] + x.t.p - tot[o]), co = Math.abs(tot[o] + x.t.p - tot[p]);
      if (cp > tol && co < cp) p = o;
      base[x.id] = p; tot[p] += x.t.p;
    });
  const ms = house.months?.[keyOf(i)] || {}, sw = ms.swap || {}, dn = ms.done || {};
  // mystery task: fixed per month; once found it stays where it was found
  let mysteryId = null;
  if (house.rules.mystery) {
    const found = Object.entries(dn).find(([, v]) => v.mystery);
    if (found) mysteryId = found[0];
    else {
      const open = d.map((x) => x.id).sort();
      if (open.length) mysteryId = open[hash(keyOf(i) + ':' + KEY) % open.length];
    }
  }
  return d.map((x) => ({ ...x, who: sw[x.id] ? 1 - base[x.id] : base[x.id], done: dn[x.id] || null, mystery: x.id === mysteryId }));
}
const bountyOpen = (i) => { const c = curRound(); return i < c || (i === c && NOW().getDate() >= (house.rules.bountyDay || 20)); };

function summary(i) {
  const pl = plan(i), dn = house.months?.[keyOf(i)]?.done || {};
  const pts = [0, 0], asg = [0, 0], own = [0, 0], cnt = [0, 0];
  Object.values(dn).forEach((d) => { pts[d.by] += d.pts || 0; cnt[d.by]++; });
  let left = 0;
  pl.forEach((x) => { asg[x.who] += x.t.p; if (x.done) { if (x.done.by === x.who) own[x.who] += x.t.p; } else left++; });
  const total = pl.length;
  return { pl, pts, asg, own, cnt, left, total, cleared: total > 0 && left === 0 };
}
const winnerOf = (s) => (s.pts[0] === s.pts[1] ? (s.pts[0] > 0 ? 2 : -1) : s.pts[0] > s.pts[1] ? 0 : 1);

function career() {
  const C = curRound();
  const res = { pts: [0, 0], titles: [0, 0], cleared: 0, rounds: [], badges: [new Set(), new Set()], titlesEarned: [new Set(), new Set()], seasons: {} };
  for (let i = 0; i <= C; i++) {
    const s = summary(i), w = winnerOf(s), k = keyOf(i), dn = house.months?.[k]?.done || {};
    res.pts[0] += s.pts[0]; res.pts[1] += s.pts[1];
    const se = (res.seasons[seasonOf(i)] = res.seasons[seasonOf(i)] || { pts: [0, 0], wins: [0, 0], rounds: 0 });
    se.pts[0] += s.pts[0]; se.pts[1] += s.pts[1];
    if (i < C) { se.rounds++; if (w === 0 || w === 2) { res.titles[0]++; se.wins[0]++; res.badges[0].add('champ'); } if (w === 1 || w === 2) { res.titles[1]++; se.wins[1]++; res.badges[1].add('champ'); } }
    if (s.cleared) { res.cleared++; res.badges[0].add('team'); res.badges[1].add('team'); }
    Object.values(dn).forEach((d) => {
      if (d.q) res.titlesEarned[d.by].add(d.q);
      if (d.bonus) res.badges[d.by].add('bounty');
      if (d.mystery) res.badges[d.by].add('mystery');
    });
    [0, 1].forEach((p) => {
      const mine = s.pl.filter((x) => x.who === p);
      if (mine.length && mine.every((x) => x.done)) {
        res.badges[p].add('sweep');
        const last = mine.map((x) => x.done.at || '').sort().pop();
        if (last && last <= `${k}-10`) res.badges[p].add('early');
      }
    });
    res.rounds.push({ i, s, w });
  }
  Object.entries(res.seasons).forEach(([sn, se]) => {
    if (se.rounds === 12) { se.done = true; se.champ = se.wins[0] === se.wins[1] ? (se.pts[0] >= se.pts[1] ? 0 : 1) : se.wins[0] > se.wins[1] ? 0 : 1; res.badges[se.champ].add('season'); }
  });
  return res;
}
const rankOf = (pts) => { let r = 0; RANKS.forEach((x, i) => { if (pts >= x[0]) r = i; }); return r; };

// ───────────── feedback: sound, haptics, confetti, toast ─────────────
let actx = null;
function tone(freqs, { dur = 0.09, type = 'sine', gap = 0.07, vol = 0.18 } = {}) {
  if (!dev.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    freqs.forEach((f, k) => {
      const t = actx.currentTime + k * gap, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch (e) { }
}
const sfx = {
  tick: () => tone([880, 1320], { dur: 0.12, gap: 0.06 }),
  swap: () => tone([520, 390], { dur: 0.08, type: 'triangle', gap: 0.05, vol: 0.14 }),
  undo: () => tone([440, 330], { dur: 0.1, type: 'triangle', gap: 0.06, vol: 0.12 }),
  win: () => tone([523, 659, 784, 1047], { dur: 0.18, type: 'triangle', gap: 0.09, vol: 0.16 }),
  mystery: () => tone([660, 880, 660, 1175], { dur: 0.12, type: 'square', gap: 0.07, vol: 0.06 }),
  tap: () => tone([1200], { dur: 0.03, vol: 0.05 }),
};
const hapticEl = (() => { const l = document.createElement('label'); l.setAttribute('aria-hidden', 'true'); l.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; l.appendChild(i); document.body.appendChild(l); return l; })();
function haptic(n = 1) {
  if (!dev.haptics) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(n > 1 ? [12, 60, 12] : 12); return; }
    hapticEl.click(); if (n > 1) setTimeout(() => hapticEl.click(), 110);
  } catch (e) { }
}
let toastT;
function toast(msg, ms = 2600) {
  const el = $('#toast'); el.innerHTML = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms);
}
function confetti(colors, big = false) {
  const c = $('#fx'); if (!c?.getContext) return;
  const ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
  const ps = [];
  for (let k = 0; k < (big ? 160 : 80); k++) ps.push({ x: W / 2 + (Math.random() - 0.5) * (big ? W : 60), y: big ? -20 : H * 0.55, vx: (Math.random() - 0.5) * (big ? 4 : 13), vy: big ? Math.random() * 3 + 2 : -Math.random() * 14 - 6, r: Math.random() * 6 + 4, c: colors[k % colors.length], a: Math.random() * 6, s: (Math.random() - 0.5) * 0.4 });
  const t0 = performance.now(), life = big ? 2600 : 1600;
  (function f(now) {
    const dt = now - t0; ctx.clearRect(0, 0, W, H);
    ps.forEach((p) => { p.vy += big ? 0.05 : 0.42; p.x += p.vx; p.y += p.vy; p.a += p.s; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - dt / life); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); ctx.restore(); });
    if (dt < life) requestAnimationFrame(f); else ctx.clearRect(0, 0, W, H);
  })(t0);
}

// ───────────── writes ─────────────
const mPath = (i, ...rest) => ['months', keyOf(i), ...rest];
function write(path, val) { store.set(path, val); }
function remove(path) { store.del(path); }

function completeTask(i, x) {
  const me = dev.me, C = curRound();
  if (me === null) return askWho();
  if (i > C) { haptic(2); return toast(`Easy, overachiever. This round opens in ${monthName(i)}.`); }
  if (x.done) {
    if (x.done.by === me) { remove(mPath(i, 'done', x.id)); sfx.undo(); haptic(); return toast('Unchecked. It happens.'); }
    return toast(`${pName(x.done.by)} already claimed this one.`);
  }
  let bonus = false;
  if (x.who !== me) {
    if (!bountyOpen(i)) { haptic(2); return toast(`That one’s ${pName(x.who)}’s. Swap it, or wait for bounty hour on the ${ordinal(house.rules.bountyDay)}.`); }
    bonus = true;
  }
  const before = career();
  const mult = (bonus ? house.rules.bountyMult || 1.5 : 1) * (x.mystery ? house.rules.mysteryMult || 2 : 1);
  const pts = Math.ceil(x.t.p * mult);
  const today = NOW(); const at = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const entry = { by: me, pts, base: x.t.p, bonus, mystery: !!x.mystery, at, n: x.t.n, q: x.t.q || 'Clean Machine' };
  write(mPath(i, 'done', x.id), entry);
  haptic(); confetti([P(me).color, '#FFC73A', '#ffffff', '#1E1A14']);
  if (x.mystery) { sfx.mystery(); toast(`❓ <b>MYSTERY TASK!</b> ${house.rules.mysteryMult || 2}× points · +${pts}`, 3200); }
  else { sfx.tick(); toast(`${bonus ? '🎯 Bounty! ' : '🏅 '}<b>${esc(entry.q)}</b> · +${pts} for ${pName(me)}`); }
  // follow-ups after the store echoes the write
  setTimeout(() => {
    const after = career(), s = summary(i);
    const r0 = rankOf(before.pts[me]), r1 = rankOf(after.pts[me]);
    if (s.cleared) { sfx.win(); confetti([P(0).color, P(1).color, '#FFC73A'], true); toast(`🎉 <b>Round cleared!</b> Team reward unlocked: ${esc(teamReward(i))}`, 4200); }
    else if (r1 > r0) { sfx.win(); toast(`${RANKS[r1][2]} Rank up! ${pName(me)} is now a <b>${RANKS[r1][1]}</b>`, 3600); }
    else {
      const nb = [...after.badges[me]].filter((b) => !before.badges[me].has(b));
      if (nb.length) { const b = SPECIAL_BADGES.find((z) => z[0] === nb[0]); if (b) toast(`${b[1]} New badge: <b>${b[2]}</b>`, 3200); }
    }
  }, 1500);
}
function swapTask(i, x) {
  if (x.done) return toast('Already done. No take-backs.');
  const k = mPath(i, 'swap', x.id);
  if (house.months?.[keyOf(i)]?.swap?.[x.id]) remove(k); else write(k, true);
  sfx.swap(); haptic();
  toast(`⇄ <b>${esc(x.t.n)}</b> → ${pName(1 - x.who)}`);
}
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
const pick = (arr, i, salt = 0) => (arr && arr.length ? arr[(i * 3 + salt) % arr.length] : '');
const teamReward = (i) => pick(house.lists.team, i, 2) || 'Bragging rights';

// ───────────── rendering ─────────────
const avatar = (p, size = '') => `<span class="av ${size}" style="--pc:${P(p).color}">${esc(P(p).emoji)}</span>`;
const syncLabel = { connecting: 'Connecting', live: 'Synced', saving: 'Saving', offline: 'Offline', local: 'This phone only', error: 'Sync issue' };
function header(title, sub, right = '') {
  return `<header class="hdr"><div><div class="hsub">${sub}</div><h1>${title}</h1></div><div class="hright"><span class="sync ${sync}"><i></i>${syncLabel[sync]}</span>${right ? `<div class="hbtns">${right}</div>` : ''}</div></header>`;
}

let renderQueued = false;
function render() {
  if (renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}
function renderNow() {
  if (!house) return;
  if (ui.view === null) ui.view = curRound();
  const main = $('#main');
  const html = { round: viewRound, board: viewBoard, tasks: viewTasks, settings: viewSettings }[ui.tab]();
  main.innerHTML = html;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === ui.tab));
  document.documentElement.style.setProperty('--p0', P(0).color);
  document.documentElement.style.setProperty('--p1', P(1).color);
}

function viewRound() {
  const i = ui.view, C = curRound(), s = summary(i), me = dev.me;
  const future = i > C, past = i < C;
  const w = winnerOf(s), car = career();
  const sub = `Round ${i + 1} · Season ${seasonOf(i) + 1}${i === C ? ' · now' : future ? ' · upcoming' : ''}`;
  const nav = `<button class="iconbtn" data-a="prev" ${i <= 0 ? 'disabled' : ''} aria-label="Previous month">${ICON.chevL}</button><button class="iconbtn" data-a="next" ${i >= C + 6 ? 'disabled' : ''} aria-label="Next month">${ICON.chevR}</button>`;
  let h = header(monthName(i) + (dateOf(i).getFullYear() !== NOW().getFullYear() ? ` <small>${dateOf(i).getFullYear()}</small>` : ''), sub, nav);

  // duel
  h += `<section class="duel">`;
  [0, 1].forEach((p) => {
    const pct = s.asg[p] ? Math.min(100, Math.round((s.own[p] / s.asg[p]) * 100)) : 0;
    const lead = (w === p) && s.pts[p] > 0;
    h += `<div class="fighter" style="--pc:${P(p).color}">${lead ? `<span class="crown">👑 ${past ? 'won' : 'leading'}</span>` : ''}
      <div class="fhead">${avatar(p)}<div><div class="fname">${pName(p)}${me === p ? ' <em>you</em>' : ''}</div><div class="frank">${RANKS[rankOf(car.pts[p])][2]} ${RANKS[rankOf(car.pts[p])][1]}</div></div></div>
      <div class="fscore">${s.pts[p]}<span>pts</span></div>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <div class="fsub">${s.own[p]}/${s.asg[p]} of their list</div></div>`;
  });
  h += `<div class="vs">VS</div></section>`;

  // team goal
  const done = s.total - s.left, tp = s.total ? Math.round((done / s.total) * 100) : 0;
  h += `<section class="card team ${s.cleared ? 'won' : ''}"><div class="row-sb"><div><div class="eyebrow">Team goal</div><div class="tg">${s.cleared ? 'Unlocked: ' : 'Clear every task → '}<b>${esc(teamReward(i))}</b></div></div><div class="tnum">${done}<span>/${s.total}</span></div></div><div class="meter team"><i style="width:${tp}%"></i></div></section>`;

  // stakes / wildcard / mystery
  const dnAll = house.months?.[keyOf(i)]?.done || {};
  const found = Object.entries(dnAll).find(([, v]) => v.mystery);
  h += `<section class="card fun">
    <div class="funrow"><span class="tag">Stakes</span><p>${esc(pick(house.lists.stakes, i))}</p></div>
    <div class="funrow"><span class="tag">Wildcard</span><p>${esc(pick(house.lists.wild, i, 1))}</p></div>
    ${house.rules.mystery ? `<div class="funrow"><span class="tag q">Mystery</span><p>${found ? `Found by <b>${pName(found[1].by)}</b>: ${esc(found[1].n)} (+${found[1].pts})` : `One task this round is secretly worth <b>${house.rules.mysteryMult || 2}×</b>. Which one? Clean to find out.`}</p></div>` : ''}
  </section>`;
  if (!future && s.left) {
    h += bountyOpen(i)
      ? `<section class="banner hot">🎯 <b>Bounty hour is open.</b> Unfinished tasks on the other side pay <b>${house.rules.bountyMult}×</b> if you snag them.</section>`
      : `<section class="banner">🎯 Bounty hour opens on the <b>${ordinal(house.rules.bountyDay)}</b>. Then unfinished tasks on the other side are fair game for ${house.rules.bountyMult}×.</section>`;
  }

  // filter
  const opp = me === null ? null : 1 - me;
  h += `<div class="filters"><div class="seg">
    <button data-a="filter" data-v="mine" class="${ui.filter === 'mine' ? 'on' : ''}">${me === null ? 'Mine' : pName(me)}</button>
    <button data-a="filter" data-v="theirs" class="${ui.filter === 'theirs' ? 'on' : ''}">${opp === null ? 'Theirs' : pName(opp)}</button>
    <button data-a="filter" data-v="all" class="${ui.filter === 'all' ? 'on' : ''}">All</button></div>
    <button class="pill ${ui.hideDone ? 'on' : ''}" data-a="hidedone">${ui.hideDone ? 'Show done' : 'Hide done'}</button></div>`;
  if (dev.swipeHint && !future) h += `<div class="hint">👉 Swipe right to finish · 👈 swipe left to swap <button data-a="hint-off" aria-label="Dismiss">✕</button></div>`;

  let rows = s.pl;
  if (ui.filter === 'mine' && me !== null) rows = rows.filter((x) => x.who === me || (x.done && x.done.by === me));
  if (ui.filter === 'theirs' && me !== null) rows = rows.filter((x) => x.who !== me && !(x.done && x.done.by === me));
  if (ui.hideDone) rows = rows.filter((x) => !x.done);
  const byRoom = {};
  rows.forEach((x) => (byRoom[x.t.r] = byRoom[x.t.r] || []).push(x));
  const order = roomsSorted().map(([r]) => r).concat(Object.keys(byRoom).filter((r) => !house.rooms[r]));
  let any = false;
  order.forEach((r) => {
    const list = byRoom[r]; if (!list) return; any = true;
    const pts = list.reduce((a, x) => a + x.t.p, 0);
    h += `<div class="glabel"><span>${room(r).e} ${esc(room(r).n)}</span><span>${pts} pts</span></div><div class="list">`;
    list.sort((a, b) => (!!a.done - !!b.done) || b.t.p - a.t.p).forEach((x) => (h += taskRow(i, x)));
    h += `</div>`;
  });
  if (!any) h += `<div class="empty">${s.total === 0 ? 'Nothing scheduled this round.' : ui.filter === 'mine' ? '✨ Your list is clear. Go snag a bounty or put your feet up.' : '✨ Nothing here.'}</div>`;

  if (i >= C) {
    const nx = plan(i + 1).filter((x) => x.kind === 'one' || x.t.f > 1);
    h += `<section class="card next"><div class="eyebrow">Coming up in ${monthName(i + 1)}</div><div class="chips">${nx.map((x) => `<span>${room(x.t.r).e} ${esc(x.t.n)}</span>`).join('')}</div><div class="fine">Plus the monthly regulars.</div></section>`;
  }
  return h;
}
function taskRow(i, x) {
  const me = dev.me, b = bountyOpen(i) && i <= curRound(), d = x.done;
  const snag = !d && b && me !== null && me !== x.who;
  const mult = snag ? house.rules.bountyMult || 1.5 : 1;
  const ptsTxt = d ? `+${d.pts}` : `${Math.ceil(x.t.p * mult)} pt${x.t.p === 1 && mult === 1 ? '' : 's'}`;
  const by = d ? d.by : x.who;
  return `<div class="swipe ${d ? 'done' : ''}" data-id="${x.id}">
    <div class="act-l">✓ Done</div><div class="act-r">Swap ⇄</div>
    <div class="fg" style="--pc:${P(x.who).color}">
      <button class="check" data-a="check" data-id="${x.id}" style="--bc:${P(by).color}" aria-label="${d ? 'Uncheck' : 'Complete'} ${esc(x.t.n)}">${ICON.check}</button>
      <div class="tbody" data-a="open" data-id="${x.id}">
        <div class="tname">${esc(x.t.n)}</div>
        <div class="tmeta"><span class="ptag ${snag ? 'snag' : ''}">${snag ? '🎯 ' : ''}${ptsTxt}</span>${x.kind === 'one' ? '<span class="one">one-off</span>' : `<span>${FREQ[x.t.f]}</span>`}${d && d.mystery ? '<span class="myst">❓ mystery 2×</span>' : ''}${d && d.bonus ? '<span class="myst">🎯 snagged</span>' : ''}${d && d.by !== x.who ? '' : ''}</div>
      </div>
      <div class="who" data-a="open" data-id="${x.id}">${avatar(by, 'sm')}</div>
    </div></div>`;
}

function viewBoard() {
  const c = career(), C = curRound(), sn = seasonOf(C), se = c.seasons[sn] || { pts: [0, 0], wins: [0, 0], rounds: 0 };
  const s0 = monthName(sn * 12, { month: 'short', year: 'numeric' }), s1 = monthName(sn * 12 + 11, { month: 'short', year: 'numeric' });
  let h = header('Board', `Season ${sn + 1} · ${s0} – ${s1}`);
  const leader = se.wins[0] === se.wins[1] ? (se.pts[0] === se.pts[1] ? -1 : se.pts[0] > se.pts[1] ? 0 : 1) : se.wins[0] > se.wins[1] ? 0 : 1;
  h += `<section class="card season"><div class="trophy">🏆</div><div class="eyebrow">Season ${sn + 1} standings · round ${Math.min(C - sn * 12 + 1, 12)} of 12</div>
    <div class="stand">${[0, 1].map((p) => `<div class="sp ${leader === p ? 'lead' : ''}" style="--pc:${P(p).color}">${avatar(p, 'lg')}<div class="spn">${pName(p)}</div><div class="spw">${se.wins[p]}<span> round${se.wins[p] === 1 ? '' : 's'} won</span></div><div class="fine">${se.pts[p]} season pts</div></div>`).join('<div class="spvs">–</div>')}</div>
    <div class="fine center">${leader === -1 ? 'Dead even. The season is wide open.' : `${pName(leader)} leads the season. Champion is crowned after round 12.`}</div></section>`;
  const past = Object.entries(c.seasons).filter(([, v]) => v.done);
  if (past.length) h += `<section class="card"><div class="eyebrow">Hall of fame</div>${past.map(([k, v]) => `<div class="hof">🥇 Season ${+k + 1}: <b>${pName(v.champ)}</b> · ${v.wins[0]}–${v.wins[1]} in rounds</div>`).join('')}</section>`;

  h += `<div class="glabel"><span>Ranks</span><span>all-time points</span></div><div class="list">`;
  [0, 1].forEach((p) => {
    const r = rankOf(c.pts[p]), nx = RANKS[r + 1], cur = RANKS[r];
    const pct = nx ? Math.round(((c.pts[p] - cur[0]) / (nx[0] - cur[0])) * 100) : 100;
    h += `<div class="lrow rank" style="--pc:${P(p).color}">${avatar(p)}<div class="grow"><div class="tname">${cur[2]} ${cur[1]}</div><div class="meter thin"><i style="width:${pct}%"></i></div><div class="fine">${c.pts[p]} pts · ${nx ? `${nx[0] - c.pts[p]} to ${nx[2]} ${nx[1]}` : 'Max rank. Absolute legend.'}</div></div></div>`;
  });
  h += `</div>`;

  h += `<section class="card teamstat"><div class="eyebrow">Team</div><div class="bigline">🤝 <b>${c.cleared}</b> round${c.cleared === 1 ? '' : 's'} fully cleared together</div><div class="fine">Each cleared round unlocks that month’s team reward.</div></section>`;

  const bp = ui.badgeP, earned = c.badges[bp], titles = c.titlesEarned[bp];
  const allTitles = [...new Set(Object.values(house.tasks).map((t) => t.q).filter(Boolean))];
  const nEarned = SPECIAL_BADGES.filter((b) => earned.has(b[0])).length + allTitles.filter((q) => titles.has(q)).length;
  h += `<div class="glabel"><span>Badges</span><span>${nEarned}/${SPECIAL_BADGES.length + allTitles.length}</span></div>
    <div class="seg wide"><button data-a="badgep" data-v="0" class="${bp === 0 ? 'on' : ''}">${pName(0)}</button><button data-a="badgep" data-v="1" class="${bp === 1 ? 'on' : ''}">${pName(1)}</button></div>
    <div class="badges">${SPECIAL_BADGES.map((b) => `<div class="badge sp ${earned.has(b[0]) ? 'got' : ''}" style="--pc:${P(bp).color}"><div class="be">${earned.has(b[0]) ? b[1] : '🔒'}</div><div class="bt">${b[2]}</div><div class="bd">${b[3]}</div></div>`).join('')}
    ${allTitles.map((q) => `<div class="badge ${titles.has(q) ? 'got' : ''}" style="--pc:${P(bp).color}"><div class="be">${titles.has(q) ? '🏅' : '·'}</div><div class="bt">${titles.has(q) ? esc(q) : '???'}</div></div>`).join('')}</div>`;

  h += `<div class="glabel"><span>Round history</span><span></span></div><div class="list">`;
  c.rounds.slice().reverse().forEach(({ i, s, w }) => {
    const live = i === C;
    h += `<div class="lrow hist" data-a="goround" data-v="${i}"><div class="grow"><div class="tname">${monthName(i, { month: 'long', year: 'numeric' })}${live ? ' <span class="livetag">live</span>' : ''}</div><div class="fine">${s.total - s.left}/${s.total} tasks${s.cleared ? ' · 🤝 cleared' : ''}</div></div>
      <div class="hscore"><span style="color:${P(0).color}">${s.pts[0]}</span> – <span style="color:${P(1).color}">${s.pts[1]}</span></div><div class="hw">${!live && w >= 0 ? (w === 2 ? '🤝' : avatar(w, 'sm')) : ''}</div></div>`;
  });
  h += `</div>`;
  return h;
}

function viewTasks() {
  const seg = ui.taskSeg;
  const all = Object.values(house.tasks);
  const avg = all.reduce((a, t) => a + t.p / t.f, 0);
  const each = Math.round((avg * (house.rules.minPerPt || 5)) / 2);
  let h = header('Tasks', `${all.length} recurring · ~${Math.round(avg)} pts a round · ≈ ${Math.floor(each / 60)}h ${String(each % 60).padStart(2, '0')}m each`, `<button class="iconbtn add" data-a="add" aria-label="Add">${ICON.plus}</button>`);
  h += `<div class="seg wide"><button data-a="tseg" data-v="recurring" class="${seg === 'recurring' ? 'on' : ''}">Recurring</button><button data-a="tseg" data-v="oneoff" class="${seg === 'oneoff' ? 'on' : ''}">One-offs</button><button data-a="tseg" data-v="rooms" class="${seg === 'rooms' ? 'on' : ''}">Rooms</button></div>`;
  const C = curRound();
  if (seg === 'recurring') {
    roomsSorted().forEach(([r, rm]) => {
      const list = Object.entries(house.tasks).filter(([, t]) => t.r === r).sort((a, b) => a[1].f - b[1].f || b[1].p - a[1].p);
      if (!list.length) return;
      h += `<div class="glabel"><span>${rm.e} ${esc(rm.n)}</span><span>${list.length}</span></div><div class="list">`;
      list.forEach(([id, t]) => {
        let nxt = C; while (((((nxt - t.off) % t.f) + t.f) % t.f !== 0 || (t.since || 0) > nxt) && nxt < C + 13) nxt++;
        h += `<div class="lrow tap" data-a="edittask" data-id="${id}"><div class="grow"><div class="tname">${esc(t.n)}</div><div class="fine">${t.p} pt${t.p === 1 ? '' : 's'} · ${FREQ[t.f]} · ${nxt === C ? 'due this round' : 'next: ' + monthName(nxt, { month: 'short' })}</div></div>${ICON.chevR}</div>`;
      });
      h += `</div>`;
    });
    const orphan = Object.entries(house.tasks).filter(([, t]) => !house.rooms[t.r]);
    if (orphan.length) h += `<div class="glabel"><span>📦 No room</span></div><div class="list">${orphan.map(([id, t]) => `<div class="lrow tap" data-a="edittask" data-id="${id}"><div class="grow"><div class="tname">${esc(t.n)}</div></div>${ICON.chevR}</div>`).join('')}</div>`;
    h += `<button class="bigbtn" data-a="add">${ICON.plus} New recurring task</button>`;
  } else if (seg === 'oneoff') {
    const list = Object.entries(house.oneoffs || {}).sort((a, b) => (a[1].m < b[1].m ? 1 : -1));
    h += `<p class="lead">One-time jobs for a specific round: deep clean before guests, post-party recovery, spring-cleaning extras. They count for points and the team goal like everything else.</p>`;
    if (!list.length) h += `<div class="empty">No one-offs yet.</div>`;
    else {
      h += `<div class="list">`;
      list.forEach(([id, t]) => { h += `<div class="lrow tap" data-a="editone" data-id="${id}"><div class="grow"><div class="tname">${room(t.r).e} ${esc(t.n)}</div><div class="fine">${t.p} pts · ${monthName(roundOfKey(t.m), { month: 'long', year: 'numeric' })} · ${t.who === 0 || t.who === 1 ? pName(t.who) : 'auto-split'}</div></div>${ICON.chevR}</div>`; });
      h += `</div>`;
    }
    h += `<button class="bigbtn" data-a="addone">${ICON.plus} New one-off task</button>`;
  } else {
    h += `<div class="list">`;
    roomsSorted().forEach(([r, rm]) => {
      const n = Object.values(house.tasks).filter((t) => t.r === r).length;
      h += `<div class="lrow tap" data-a="editroom" data-id="${r}"><span class="remoji">${rm.e}</span><div class="grow"><div class="tname">${esc(rm.n)}</div><div class="fine">${n} recurring task${n === 1 ? '' : 's'}</div></div><span class="ord"><button class="iconbtn sm" data-a="roomup" data-id="${r}" aria-label="Move up">${ICON.up}</button></span></div>`;
    });
    h += `</div><button class="bigbtn" data-a="addroom">${ICON.plus} Add a room</button>`;
  }
  return h;
}
const roundOfKey = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + (m - 1) - epochAbs(); };

function viewSettings() {
  const r = house.rules;
  let h = header('Settings', 'Make it yours');
  h += `<div class="glabel"><span>This phone</span></div><div class="list">
    <div class="lrow"><div class="grow"><div class="tname">This phone belongs to</div></div><div class="seg sm"><button data-a="setme" data-v="0" class="${dev.me === 0 ? 'on' : ''}">${pName(0)}</button><button data-a="setme" data-v="1" class="${dev.me === 1 ? 'on' : ''}">${pName(1)}</button></div></div>
    <label class="lrow"><div class="grow"><div class="tname">Sounds</div></div><input type="checkbox" switch class="sw" data-a="dev" data-k="sound" ${dev.sound ? 'checked' : ''}></label>
    <label class="lrow"><div class="grow"><div class="tname">Haptics</div></div><input type="checkbox" switch class="sw" data-a="dev" data-k="haptics" ${dev.haptics ? 'checked' : ''}></label>
    <label class="lrow"><div class="grow"><div class="tname">Swipe hint</div></div><input type="checkbox" switch class="sw" data-a="dev" data-k="swipeHint" ${dev.swipeHint ? 'checked' : ''}></label></div>`;
  h += `<div class="glabel"><span>Players</span></div><div class="list">${[0, 1].map((p) => `<div class="lrow tap" data-a="editplayer" data-v="${p}">${avatar(p)}<div class="grow"><div class="tname">${pName(p)}</div><div class="fine">Tap to change name, avatar, color</div></div>${ICON.chevR}</div>`).join('')}</div>`;
  const stepper = (k, v, lbl, sub) => `<div class="lrow"><div class="grow"><div class="tname">${lbl}</div><div class="fine">${sub}</div></div><div class="stepper"><button data-a="step" data-k="${k}" data-d="-1">−</button><span>${v}</span><button data-a="step" data-k="${k}" data-d="1">+</button></div></div>`;
  const choice = (k, opts, lbl, sub) => `<div class="lrow col"><div><div class="tname">${lbl}</div><div class="fine">${sub}</div></div><div class="seg wide">${opts.map(([v, t]) => `<button data-a="rule" data-k="${k}" data-v="${v}" class="${r[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
  h += `<div class="glabel"><span>Rules & bonuses</span></div><div class="list">
    ${stepper('bountyDay', ordinal(r.bountyDay), 'Bounty hour opens', 'Day of the month stealing unlocks')}
    ${choice('bountyMult', [[1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']], 'Bounty multiplier', 'Points for snagging the other person’s task')}
    <label class="lrow"><div class="grow"><div class="tname">Mystery task</div><div class="fine">One secret bonus task each round</div></div><input type="checkbox" switch class="sw" data-a="rulebool" data-k="mystery" ${r.mystery ? 'checked' : ''}></label>
    ${r.mystery ? choice('mysteryMult', [[2, '2×'], [3, '3×']], 'Mystery multiplier', 'How much the secret task pays') : ''}
    ${stepper('tolerance', r.tolerance + ' pts', 'Auto-split fairness', 'Max point gap the auto-split allows')}
    ${stepper('minPerPt', r.minPerPt + ' min', '1 point ≈', 'Used for time estimates')}</div>`;
  h += `<div class="glabel"><span>Fun lists</span></div><div class="list">
    <div class="lrow tap" data-a="editlist" data-k="stakes"><div class="grow"><div class="tname">💰 Monthly stakes</div><div class="fine">${house.lists.stakes.length} options · rotates each round</div></div>${ICON.chevR}</div>
    <div class="lrow tap" data-a="editlist" data-k="wild"><div class="grow"><div class="tname">🃏 Wildcard rules</div><div class="fine">${house.lists.wild.length} options</div></div>${ICON.chevR}</div>
    <div class="lrow tap" data-a="editlist" data-k="team"><div class="grow"><div class="tname">🤝 Team rewards</div><div class="fine">${house.lists.team.length} options · unlocked by clearing a round</div></div>${ICON.chevR}</div></div>`;
  const other = dev.me === null ? 1 : 1 - dev.me;
  h += `<div class="glabel"><span>Household</span></div><div class="list">
    <div class="lrow tap" data-a="invite"><div class="grow"><div class="tname">📲 Invite ${pName(other)}</div><div class="fine">Copy her link · she opens it in Safari → Share → Add to Home Screen</div></div>${ICON.chevR}</div>
    <div class="lrow tap" data-a="install"><div class="grow"><div class="tname">📱 Put it on your home screen</div><div class="fine">How to install on iPhone</div></div>${ICON.chevR}</div>
    <div class="lrow"><div class="grow"><div class="tname">Sync</div><div class="fine">${store?.mode === 'cloud' ? 'Live between both phones' : 'Demo mode: saved on this phone only'}</div></div></div></div>
    <p class="fine center foot">The Grime League · season ${seasonOf(curRound()) + 1}<br>Household code ${esc(KEY.slice(0, 4))}…${esc(KEY.slice(-4))}</p>`;
  return h;
}

// ───────────── sheets (bottom modals) ─────────────
function sheet(html, handlers = {}) {
  const ov = document.createElement('div');
  ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 280); };
  ov.addEventListener('click', (e) => {
    if (e.target === ov && !handlers.locked) return close();
    const a = e.target.closest('[data-s]');
    if (!a) return;
    const v = a.dataset.s;
    if (v === 'close') return close();
    handlers.action?.(v, a, ov, close);
  });
  // drag the grabber down to dismiss
  const sh = ov.querySelector('.sheet'); let y0 = null;
  sh.addEventListener('touchstart', (e) => { if (sh.scrollTop <= 0 && e.target.closest('.grab, h2')) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', (e) => { if (y0 === null) return; const dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', (e) => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; sh.style.transform = ''; if (dy > 110 && !handlers.locked) close(); });
  handlers.mount?.(ov);
  return { ov, close };
}
function findRow(i, id) { return plan(i).find((x) => x.id === id); }

function openTask(i, id) {
  const x = findRow(i, id); if (!x) return;
  const me = dev.me, d = x.done, C = curRound();
  const snag = !d && bountyOpen(i) && me !== null && me !== x.who && i <= C;
  const canDo = !d && i <= C && (x.who === me || snag);
  let btns = '';
  if (canDo) btns += `<button class="bigbtn primary" data-s="do" style="--pc:${P(me).color}">${snag ? `🎯 Snag it · +${Math.ceil(x.t.p * house.rules.bountyMult)}` : `✓ Done · +${x.t.p}${x.mystery ? '?' : ''}`}</button>`;
  if (d && d.by === me) btns += `<button class="bigbtn" data-s="undo">Undo</button>`;
  if (!d) btns += `<button class="bigbtn" data-s="swap">⇄ Give to ${pName(1 - x.who)}</button>`;
  btns += `<button class="bigbtn ghost" data-s="edit">Edit task</button>`;
  sheet(`<div class="shead"><span class="remoji">${room(x.t.r).e}</span><div><div class="eyebrow">${esc(room(x.t.r).n)} · ${x.kind === 'one' ? 'one-off' : FREQ[x.t.f]}</div><h2>${esc(x.t.n)}</h2></div></div>
    <div class="facts"><div><b>${x.t.p}</b><span>points</span></div><div>${avatar(x.who, 'sm')}<span>${pName(x.who)}’s</span></div><div><b>${Math.round(x.t.p * (house.rules.minPerPt || 5))}</b><span>~minutes</span></div></div>
    ${d ? `<div class="donebox" style="--pc:${P(d.by).color}">✓ Done by <b>${pName(d.by)}</b> · +${d.pts}${d.mystery ? ' · ❓ mystery task!' : ''}${d.bonus ? ' · 🎯 bounty' : ''}</div>` : ''}
    ${x.t.tip ? `<div class="tipbox">💡 ${esc(x.t.tip)}</div>` : ''}
    <div class="earn">🏅 Earns the <b>${esc(x.t.q || 'Clean Machine')}</b> badge</div>
    <div class="btns">${btns}</div>`, {
    action(v, a, ov, close) {
      const cur = findRow(i, id); if (!cur) return close();
      if (v === 'do' || v === 'undo') { close(); completeTask(i, cur); }
      if (v === 'swap') { close(); swapTask(i, cur); }
      if (v === 'edit') { close(); x.kind === 'one' ? editOneoff(id) : editTask(id); }
    },
  });
}

const fieldRoom = (sel) => `<label class="fld"><span>Room</span><select name="r">${roomsSorted().map(([r, rm]) => `<option value="${r}" ${r === sel ? 'selected' : ''}>${rm.e} ${esc(rm.n)}</option>`).join('')}</select></label>`;
const fieldPts = (v) => `<div class="fld"><span>Points <em>(1 pt ≈ ${house.rules.minPerPt || 5} min)</em></span><div class="stepper big"><button type="button" data-s="pts-">−</button><span class="ptsv">${v}</span><button type="button" data-s="pts+">+</button></div></div>`;
function ptsHandler(v, ov) { if (v !== 'pts-' && v !== 'pts+') return false; const el = ov.querySelector('.ptsv'); el.textContent = Math.max(1, Math.min(10, +el.textContent + (v === 'pts+' ? 1 : -1))); haptic(); return true; }
const val = (ov, n) => ov.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
const newId = (pfx) => pfx + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function editTask(id) {
  const isNew = !id; const t = isNew ? { n: '', r: roomsSorted()[0]?.[0], p: 2, f: 1, q: '', tip: '' } : house.tasks[id];
  if (!t) return;
  sheet(`<div class="shead"><div><div class="eyebrow">${isNew ? 'New recurring task' : 'Edit task'}</div><h2>${isNew ? 'Add a task' : esc(t.n)}</h2></div></div>
    <label class="fld"><span>Task</span><input name="n" value="${esc(t.n)}" placeholder="e.g. Descale the humidifier" maxlength="70"></label>
    ${fieldRoom(t.r)}${fieldPts(t.p)}
    <div class="fld"><span>How often</span><div class="seg wide fseg">${[[1, '1 mo'], [2, '2 mo'], [3, '3 mo'], [6, '6 mo'], [12, 'Yearly']].map(([f, l]) => `<button type="button" data-s="f${f}" class="${t.f === f ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${isNew ? `<div class="fld"><span>First round</span><div class="seg wide sseg"><button type="button" data-s="s0" class="on">This month</button><button type="button" data-s="s1">Next month</button></div></div>` : ''}
    <label class="fld"><span>Badge title <em>(earned the first time you do it)</em></span><input name="q" value="${esc(t.q)}" placeholder="e.g. Humidifier Hero" maxlength="40"></label>
    <label class="fld"><span>How-to tip <em>(optional)</em></span><textarea name="tip" rows="3" maxlength="400" placeholder="Anything that makes it faster">${esc(t.tip)}</textarea></label>
    <div class="btns"><button class="bigbtn primary" data-s="save">${isNew ? 'Add task' : 'Save'}</button>${isNew ? '' : '<button class="bigbtn danger" data-s="del">Delete task</button>'}<button class="bigbtn ghost" data-s="close">Cancel</button></div>`, {
    action(v, a, ov, close) {
      if (ptsHandler(v, ov)) return;
      if (/^f\d+$/.test(v) || /^s\d$/.test(v)) { a.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === a)); haptic(); return; }
      if (v === 'del') {
        if (a.dataset.armed) { remove(['tasks', id]); close(); toast('Task deleted. Its history and points stay.'); return; }
        a.dataset.armed = 1; a.textContent = 'Tap again to delete'; haptic(2); return;
      }
      if (v === 'save') {
        const n = val(ov, 'n'); if (!n) { ov.querySelector('[name=n]').focus(); return toast('Give it a name first.'); }
        const f = +ov.querySelector('.fseg .on').dataset.s.slice(1), p = +ov.querySelector('.ptsv').textContent;
        const C = curRound();
        const nt = { ...t, n, r: val(ov, 'r'), p, f, q: val(ov, 'q') || `${n.split(/[\s:,]+/)[0]} Champion`, tip: val(ov, 'tip') };
        if (isNew) { const start = C + (ov.querySelector('.sseg .on').dataset.s === 's1' ? 1 : 0); nt.since = start; nt.off = start % f; }
        else if (f !== t.f) { nt.off = C % f; }
        delete nt.ix;
        write(['tasks', id || newId('t')], nt); close(); haptic(); sfx.tick();
        toast(isNew ? `Added <b>${esc(n)}</b> ✨` : 'Saved.');
      }
    },
  });
}
function editOneoff(id) {
  const isNew = !id, C = curRound();
  const t = isNew ? { n: '', r: roomsSorted()[0]?.[0], p: 3, m: keyOf(C), who: null } : house.oneoffs[id];
  if (!t) return;
  const rr = roundOfKey(t.m);
  const months = [C, C + 1, C + 2]; if (!months.includes(rr)) months.unshift(rr);
  sheet(`<div class="shead"><div><div class="eyebrow">${isNew ? 'New one-off' : 'Edit one-off'}</div><h2>${isNew ? 'One-time job' : esc(t.n)}</h2></div></div>
    <label class="fld"><span>Task</span><input name="n" value="${esc(t.n)}" placeholder="e.g. Deep clean before Mom visits" maxlength="70"></label>
    ${fieldRoom(t.r)}${fieldPts(t.p)}
    <div class="fld"><span>Which round</span><div class="seg wide mseg">${months.map((m) => `<button type="button" data-s="m${m}" class="${m === rr ? 'on' : ''}">${monthName(m, { month: 'short' })}</button>`).join('')}</div></div>
    <div class="fld"><span>Who</span><div class="seg wide wseg"><button type="button" data-s="wa" class="${t.who !== 0 && t.who !== 1 ? 'on' : ''}">Auto-split</button><button type="button" data-s="w0" class="${t.who === 0 ? 'on' : ''}">${pName(0)}</button><button type="button" data-s="w1" class="${t.who === 1 ? 'on' : ''}">${pName(1)}</button></div></div>
    <label class="fld"><span>How-to tip <em>(optional)</em></span><textarea name="tip" rows="2" maxlength="400">${esc(t.tip || '')}</textarea></label>
    <div class="btns"><button class="bigbtn primary" data-s="save">${isNew ? 'Add one-off' : 'Save'}</button>${isNew ? '' : '<button class="bigbtn danger" data-s="del">Delete</button>'}<button class="bigbtn ghost" data-s="close">Cancel</button></div>`, {
    action(v, a, ov, close) {
      if (ptsHandler(v, ov)) return;
      if (/^[mw]/.test(v) && a.parentElement.classList.contains('seg')) { a.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === a)); haptic(); return; }
      if (v === 'del') { if (a.dataset.armed) { remove(['oneoffs', id]); close(); return toast('One-off deleted.'); } a.dataset.armed = 1; a.textContent = 'Tap again to delete'; haptic(2); return; }
      if (v === 'save') {
        const n = val(ov, 'n'); if (!n) return toast('Give it a name first.');
        const m = keyOf(+ov.querySelector('.mseg .on').dataset.s.slice(1)), w = ov.querySelector('.wseg .on').dataset.s;
        write(['oneoffs', id || newId('o')], { n, r: val(ov, 'r'), p: +ov.querySelector('.ptsv').textContent, m, who: w === 'wa' ? null : +w.slice(1), q: t.q || 'One-Off Wonder', tip: val(ov, 'tip') });
        close(); haptic(); sfx.tick(); toast(isNew ? `Added <b>${esc(n)}</b> to ${monthName(roundOfKey(m))}` : 'Saved.');
      }
    },
  });
}
function editRoom(id) {
  const isNew = !id, rm = isNew ? { n: '', e: '📦', o: Object.keys(house.rooms).length } : house.rooms[id];
  const n = isNew ? 0 : Object.values(house.tasks).filter((t) => t.r === id).length;
  sheet(`<div class="shead"><div><div class="eyebrow">${isNew ? 'New room' : 'Edit room'}</div><h2>${isNew ? 'Add a room' : esc(rm.n)}</h2></div></div>
    <label class="fld"><span>Name</span><input name="n" value="${esc(rm.n)}" placeholder="e.g. Basement" maxlength="30"></label>
    <div class="fld"><span>Icon</span><div class="emojis">${ROOM_EMOJI.map((e) => `<button type="button" data-s="e:${e}" class="${e === rm.e ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    <div class="btns"><button class="bigbtn primary" data-s="save">${isNew ? 'Add room' : 'Save'}</button>${isNew ? '' : `<button class="bigbtn danger" data-s="del">${n ? `Delete room + its ${n} task${n === 1 ? '' : 's'}` : 'Delete room'}</button>`}<button class="bigbtn ghost" data-s="close">Cancel</button></div>`, {
    action(v, a, ov, close) {
      if (v.startsWith('e:')) { ov.querySelectorAll('.emojis button').forEach((b) => b.classList.toggle('on', b === a)); haptic(); return; }
      if (v === 'del') {
        if (!a.dataset.armed) { a.dataset.armed = 1; a.textContent = 'Tap again to delete'; haptic(2); return; }
        const pairs = [[['rooms', id], undefined]];
        Object.entries(house.tasks).forEach(([tid, t]) => { if (t.r === id) pairs.push([['tasks', tid], undefined]); });
        store.multi(pairs); close(); return toast('Room deleted.');
      }
      if (v === 'save') {
        const name = val(ov, 'n'); if (!name) return toast('Name the room first.');
        const e = ov.querySelector('.emojis .on')?.dataset.s.slice(2) || '📦';
        write(['rooms', id || newId('r')], { ...rm, n: name, e }); close(); haptic(); toast(isNew ? `${e} ${esc(name)} added` : 'Saved.');
      }
    },
  });
}
function editPlayer(p) {
  const pl = P(p);
  sheet(`<div class="shead">${avatar(p, 'lg')}<div><div class="eyebrow">Player ${p + 1}</div><h2>${pName(p)}</h2></div></div>
    <label class="fld"><span>Name</span><input name="n" value="${esc(pl.name)}" maxlength="16"></label>
    <div class="fld"><span>Avatar</span><div class="emojis">${PLAYER_EMOJI.map((e) => `<button type="button" data-s="e:${e}" class="${e === pl.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    <div class="fld"><span>Color</span><div class="swatches">${PALETTE.map((c) => `<button type="button" data-s="c:${c}" class="${c === pl.color ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="btns"><button class="bigbtn primary" data-s="save">Save</button><button class="bigbtn ghost" data-s="close">Cancel</button></div>`, {
    action(v, a, ov, close) {
      if (v.startsWith('e:') || v.startsWith('c:')) { a.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === a)); haptic(); return; }
      if (v === 'save') {
        const name = val(ov, 'n') || pl.name;
        const emoji = ov.querySelector('.emojis .on')?.dataset.s.slice(2) || pl.emoji;
        const color = ov.querySelector('.swatches .on')?.dataset.s.slice(2) || pl.color;
        if (color === P(1 - p).color) return toast(`${pName(1 - p)} already has that color.`);
        const pls = house.players.map((x) => ({ ...x })); pls[p] = { name, emoji, color }; write(['players'], pls);
        close(); sfx.tick(); haptic();
      }
    },
  });
}
function editList(k) {
  const title = { stakes: '💰 Monthly stakes', wild: '🃏 Wildcard rules', team: '🤝 Team rewards' }[k];
  sheet(`<div class="shead"><div><div class="eyebrow">One per line · rotates each round</div><h2>${title}</h2></div></div>
    <label class="fld"><textarea name="l" rows="10">${esc(house.lists[k].join('\n'))}</textarea></label>
    <div class="btns"><button class="bigbtn primary" data-s="save">Save</button><button class="bigbtn ghost" data-s="close">Cancel</button></div>`, {
    action(v, a, ov, close) {
      if (v !== 'save') return;
      const lines = ov.querySelector('[name=l]').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 40);
      if (!lines.length) return toast('Keep at least one.');
      write(['lists', k], lines); close(); toast('Saved.');
    },
  });
}
function invite() {
  const other = dev.me === null ? 1 : 1 - dev.me, link = inviteLink(other);
  sheet(`<div class="shead"><div><div class="eyebrow">Invite</div><h2>Send ${pName(other)} her link</h2></div></div>
    <p class="lead">This link joins your household and sets her phone up as ${pName(other)}. Anyone with it can edit your chart, so just send it to her.</p>
    <div class="linkbox">${esc(link)}</div>
    <div class="btns"><button class="bigbtn primary" data-s="copy">Copy link</button>${navigator.share ? '<button class="bigbtn" data-s="share">Share…</button>' : ''}<button class="bigbtn ghost" data-s="close">Done</button></div>
    <p class="fine">She opens it in <b>Safari</b>, then Share → <b>Add to Home Screen</b>.</p>`, {
    async action(v, a) {
      if (v === 'copy') { try { await navigator.clipboard.writeText(link); a.textContent = 'Copied ✓'; haptic(); } catch (e) { toast('Press and hold the link to copy it.'); } }
      if (v === 'share') { try { await navigator.share({ title: 'The Grime League', text: 'Our deep-clean league. Open in Safari, then Share → Add to Home Screen.', url: link }); } catch (e) { } }
    },
  });
}
function installHelp() {
  sheet(`<div class="shead"><div><div class="eyebrow">iPhone</div><h2>Add to Home Screen</h2></div></div>
    <ol class="steps"><li>Open this page in <b>Safari</b> (not inside another app’s browser).</li><li>Tap the <b>Share</b> button ${ICON.share}</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open it from the new icon. It runs full-screen like an app and remembers which player you are.</li></ol>
    <div class="btns"><button class="bigbtn ghost" data-s="close">Got it</button></div>`);
}
function askWho() {
  sheet(`<div class="shead"><div><div class="eyebrow">Welcome to the league</div><h2>Who’s holding this phone?</h2></div></div>
    <div class="pick">${[0, 1].map((p) => `<button data-s="p${p}" style="--pc:${P(p).color}">${avatar(p, 'lg')}<span>${pName(p)}</span></button>`).join('')}</div>
    <p class="fine center">You can change this later in Settings.</p>`, {
    locked: true,
    action(v, a, ov, close) { dev.me = +v.slice(1); saveDev(); pinUrl(); close(); haptic(); sfx.win(); toast(`Game on, ${pName(dev.me)} ${esc(P(dev.me).emoji)}`); render(); },
  });
}

// ───────────── events ─────────────
document.addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  const tab = e.target.closest('.tab');
  if (tab) { ui.tab = tab.dataset.tab; haptic(); sfx.tap(); $('#main').scrollTo(0, 0); render(); return; }
  const a = e.target.closest('#main [data-a]'); if (!a || !house) return;
  const act = a.dataset.a, id = a.dataset.id, v = a.dataset.v, i = ui.view;
  switch (act) {
    case 'prev': ui.view = Math.max(0, i - 1); haptic(); render(); break;
    case 'next': ui.view = Math.min(curRound() + 6, i + 1); haptic(); render(); break;
    case 'filter': ui.filter = v; haptic(); render(); break;
    case 'hidedone': ui.hideDone = !ui.hideDone; haptic(); render(); break;
    case 'hint-off': dev.swipeHint = false; saveDev(); render(); break;
    case 'check': { const x = findRow(i, id); if (x) completeTask(i, x); break; }
    case 'open': openTask(i, id); break;
    case 'badgep': ui.badgeP = +v; haptic(); render(); break;
    case 'goround': ui.view = +v; ui.tab = 'round'; ui.filter = 'all'; render(); $('#main').scrollTo(0, 0); break;
    case 'tseg': ui.taskSeg = v; haptic(); render(); break;
    case 'add': ui.taskSeg === 'oneoff' ? editOneoff() : ui.taskSeg === 'rooms' ? editRoom() : editTask(); break;
    case 'addone': editOneoff(); break;
    case 'addroom': editRoom(); break;
    case 'edittask': editTask(id); break;
    case 'editone': editOneoff(id); break;
    case 'editroom': if (!e.target.closest('[data-a=roomup]')) editRoom(id); break;
    case 'roomup': {
      e.stopPropagation();
      const list = roomsSorted(), k = list.findIndex(([r]) => r === id);
      if (k > 0) { const pairs = list.map(([r], j) => [['rooms', r, 'o'], j === k ? k - 1 : j === k - 1 ? k : j]); store.multi(pairs); haptic(); }
      break;
    }
    case 'setme': dev.me = +v; saveDev(); pinUrl(); haptic(); render(); break;
    case 'editplayer': editPlayer(+v); break;
    case 'step': {
      const k = a.dataset.k, d = +a.dataset.d, r = house.rules;
      const lim = { bountyDay: [1, 28], tolerance: [0, 10], minPerPt: [2, 15] }[k];
      const nv = Math.max(lim[0], Math.min(lim[1], (r[k] ?? 0) + d));
      if (nv !== r[k]) { write(['rules', k], nv); haptic(); }
      break;
    }
    case 'rule': write(['rules', a.dataset.k], +v); haptic(); break;
    case 'editlist': editList(a.dataset.k); break;
    case 'invite': invite(); break;
    case 'install': installHelp(); break;
  }
});
document.addEventListener('change', (e) => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  if (a.dataset.a === 'dev') { dev[a.dataset.k] = a.checked; saveDev(); if (a.dataset.k === 'sound' && a.checked) sfx.tick(); render(); }
  if (a.dataset.a === 'rulebool') { write(['rules', a.dataset.k], a.checked); }
});

// swipe rows: right = done, left = swap
let sw = null, suppressClick = false;
const TH = 84;
document.addEventListener('pointerdown', (e) => {
  const row = e.target.closest('.swipe'); if (!row || e.button > 0) return;
  sw = { row, fg: row.querySelector('.fg'), x0: e.clientX, y0: e.clientY, dx: 0, on: false, pid: e.pointerId, past: false };
});
document.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.pid) return;
  const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
  if (!sw.on) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { sw.on = true; sw.row.classList.add('dragging'); try { sw.row.setPointerCapture(sw.pid); } catch (er) { } }
    else if (Math.abs(dy) > 10) { sw = null; return; }
    else return;
  }
  const done = sw.row.classList.contains('done');
  let d = dx; if (done && d < 0) d = d / 4; // can't swap a finished task
  if (Math.abs(d) > TH) d = Math.sign(d) * (TH + (Math.abs(d) - TH) * 0.35);
  sw.dx = dx; sw.fg.style.transform = `translateX(${d}px)`;
  sw.row.classList.toggle('show-l', dx > 0); sw.row.classList.toggle('show-r', dx < 0);
  const past = Math.abs(dx) > TH && !(done && dx < 0);
  if (past !== sw.past) { sw.past = past; sw.row.classList.toggle('armed', past); if (past) haptic(); }
});
function endSwipe(e) {
  if (!sw || (e && e.pointerId !== sw.pid)) return;
  const s = sw; sw = null;
  if (!s.on) return;
  suppressClick = true; setTimeout(() => (suppressClick = false), 350);
  s.row.classList.remove('dragging', 'armed');
  s.fg.style.transform = '';
  setTimeout(() => s.row.classList.remove('show-l', 'show-r'), 250);
  const x = findRow(ui.view, s.row.dataset.id); if (!x) return;
  if (s.dx > TH) completeTask(ui.view, x);
  else if (s.dx < -TH && !x.done) swapTask(ui.view, x);
}
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', endSwipe);

// ───────────── icons ─────────────
const svg = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 20),
  chevL: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevR: svg('<path d="M9 5l7 7-7 7"/>', 18),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
  up: svg('<path d="M6 15l6-6 6 6"/>', 16),
  share: svg('<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>', 18),
};

// ───────────── boot ─────────────
if (!('switch' in HTMLInputElement.prototype)) document.documentElement.classList.add('noswitch');
function welcome() {
  $('#main').innerHTML = `<div class="welcome"><div class="logo">🧽</div><div class="hsub">Deep clean, but make it a sport</div><h1 class="wtitle">The Grime<br><span>League</span></h1>
    <p class="lead">A monthly deep-clean league for two. Split the jobs, trade the ones you hate, steal the ones they skip, and crown a champion every season.</p>
    <button class="bigbtn primary" data-w="new">Start our league</button>
    <div class="or">or join with an invite link</div>
    <div class="joinrow"><input id="joinlink" placeholder="Paste invite link" autocomplete="off"><button class="bigbtn" data-w="join">Join</button></div></div>`;
  document.body.classList.add('noTabs');
  $('#main').onclick = (e) => {
    const w = e.target.closest('[data-w]'); if (!w) return;
    if (w.dataset.w === 'new') { KEY = newKey(); boot(); }
    if (w.dataset.w === 'join') {
      const raw = $('#joinlink').value.trim(); let k = null, p = null;
      try { const u = new URL(raw); k = u.searchParams.get('h'); p = u.searchParams.get('p'); } catch (er) { k = raw; }
      if (!k || !/^[A-Za-z0-9]{12,40}$/.test(k)) return toast('That link doesn’t look right.');
      KEY = k; if (p === '0' || p === '1') { dev.me = +p; saveDev(); }
      boot();
    }
  };
}
let lastDone = null;
async function boot() {
  if (!KEY) return welcome();
  document.body.classList.remove('noTabs'); $('#main').onclick = null;
  pinUrl();
  $('#main').innerHTML = `<div class="loading"><div class="logo spin">🧽</div><p>Scrubbing in…</p></div>`;
  try {
    store = await openStore({
      key: KEY,
      makeDefaults: makeDefaultHouse,
      onStatus: (st) => { if (st !== sync) { sync = st; const el = document.querySelector('.sync'); if (el) { el.className = `sync ${st}`; el.innerHTML = `<i></i>${syncLabel[st]}`; } } },
      onData: (d) => {
        const first = !house;
        house = d;
        house.lists = house.lists || {}; ['stakes', 'wild', 'team'].forEach((k) => (house.lists[k] = house.lists[k] || []));
        house.tasks = house.tasks || {}; house.rooms = house.rooms || {}; house.oneoffs = house.oneoffs || {}; house.months = house.months || {};
        // celebrate the other player's progress as it arrives
        const k = keyOf(curRound()), dn = house.months[k]?.done || {};
        if (lastDone && dev.me !== null) {
          Object.entries(dn).forEach(([id, v]) => { if (!lastDone[id] && v.by !== dev.me) { toast(`${esc(P(v.by).emoji)} <b>${pName(v.by)}</b> just finished ${esc(v.n)} · +${v.pts}`, 3200); haptic(); } });
        }
        lastDone = JSON.parse(JSON.stringify(dn));
        render();
        if (first && dev.me === null) setTimeout(askWho, 250);
      },
    });
  } catch (e) {
    $('#main').innerHTML = `<div class="loading"><div class="logo">📡</div><p>Can’t reach the league right now.<br>Check your connection and reopen the app.</p></div>`;
  }
}
// keep "today" fresh when the app is reopened from the home screen
document.addEventListener('visibilitychange', () => { if (!document.hidden && house) { ui.view = ui.view === null ? null : Math.min(ui.view, curRound() + 6); render(); } });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
boot();
