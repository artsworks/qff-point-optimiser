'use strict';
/* QFF Points Optimiser — all logic client-side, state in localStorage. */

// ── Constants (Zone 6, per-person RETURN, Qantas table from 5 Aug 2025) ──
const REWARD_PTS = { economy: 72400, premium: 147600, business: 196800, first: 295400 };
const UPGRADE_PRESETS = { paid: 78500, flexible: 43100, reward: 83600 }; // Econ→Business, pp one-way
const LS_KEY = 'qff-optimiser-v1';

// 2027 ranges [startISO, endISO] inclusive
const VIC_HOLIDAYS = [
  ['Autumn holidays', '2027-03-26', '2027-04-11'],
  ['Winter holidays', '2027-06-26', '2027-07-11'],
  ['Spring holidays', '2027-09-18', '2027-10-03'],
  ['Summer holidays', '2027-12-18', '2028-01-28'], // 2028 end approx.
];
const PREFERRED = [
  ['12 Apr – 25 Jun', '2027-04-12', '2027-06-25'],
  ['12 Jul – 17 Sep', '2027-07-12', '2027-09-17'],
  ['4 Oct – 17 Dec', '2027-10-04', '2027-12-17'],
];
const JP_BUSY = [
  ['Golden Week', '2027-04-29', '2027-05-06'],
  ['Obon', '2027-08-13', '2027-08-16'],
  ['Silver Week', '2027-09-18', '2027-09-23'],
  ['New Year', '2027-12-28', '2028-01-04'],
];

// ── State ──────────────────────────────────────────────────────────
const DEFAULTS = {
  balance: 400000, travellers: 2, sectors: 2, taxes: 600, futureCpp: 1.2,
  econCash: 2400, premCash: 0, bizCash: 10000,
  upgradeType: 'paid', upgradeCustom: 78500, fareClass: 'eligible', prob: 50,
  bizSeats: 0, econSeats: 0, depart: '', ret: '',
  rows: [],
};
let state = load();

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// ── Format helpers ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmtPts = (n) => Math.round(n).toLocaleString('en-AU');
const fmtAud = (n) => '$' + Math.round(n).toLocaleString('en-AU');
const fmtCpp = (c) => isFinite(c) ? c.toFixed(2) + '¢' : '—';
function cppClass(c) { return !isFinite(c) ? '' : c >= 1.5 ? 'good' : c >= 1 ? 'warn' : 'bad'; }

// ── Core maths ─────────────────────────────────────────────────────
function rewardRow(cabin, cashEquiv, taxes, T, balance, f) {
  const pts = REWARD_PTS[cabin] * T;
  const net = cashEquiv > 0 ? cashEquiv - taxes : NaN;
  const cpp = net / pts * 100;
  const left = balance - pts;
  const score = (isFinite(net) ? net : 0) + Math.max(0, left) * f;
  return { pts, left, net, cpp, score, fits: pts <= balance };
}
function upgradeMath(s) {
  const perSector = s.upgradeType === 'custom' ? s.upgradeCustom : UPGRADE_PRESETS[s.upgradeType];
  const U = perSector * s.travellers * s.sectors;
  const P = s.prob / 100;
  const f = s.futureCpp / 100;
  const cabinEV = P * s.bizCash + (1 - P) * s.econCash;
  const netEV = cabinEV - s.econCash;                       // = P·(B−E)
  const cppIfClears = (s.bizCash - s.econCash) / U * 100;   // value of the 314k if it works
  const evPerCommitted = netEV / U * 100;
  const expLeft = s.balance - P * U;
  const score = netEV + expLeft * f;
  // Breakeven vs Business Reward on expected total value:
  // score_biz = (B − taxes) + (balance − ptsBiz)·f ;  score_upg = P·(B−E) + (balance − P·U)·f
  const ptsBiz = REWARD_PTS.business * s.travellers;
  const num = (s.bizCash - s.taxes) - ptsBiz * f;           // Score_biz − balance·f
  const den = (s.bizCash - s.econCash) - U * f;
  const pStar = den > 0 ? num / den : NaN;
  return { U, P, netEV, cppIfClears, evPerCommitted, expLeft, score, pStar, ptsBiz };
}

// ── Render: strategy table ─────────────────────────────────────────
function renderStrategies() {
  const s = state, T = s.travellers, f = s.futureCpp / 100, tb = $('strategy-table').tBodies[0];
  const rows = [
    { name: 'Economy Classic Reward', ...rewardRow('economy', s.econCash, s.taxes, T, s.balance, f), cabin: 'Economy — confirmed', cash: s.taxes },
    { name: 'Premium Economy Reward', ...rewardRow('premium', s.premCash, s.taxes, T, s.balance, f), cabin: 'Prem. Econ — confirmed', cash: s.taxes },
    { name: 'Business Classic Reward', ...rewardRow('business', s.bizCash, s.taxes, T, s.balance, f), cabin: 'Business — confirmed', cash: s.taxes },
    { name: 'First Classic Reward', ...rewardRow('first', 0, s.taxes, T, s.balance, f), cabin: 'First — confirmed', cash: s.taxes },
  ];
  const u = upgradeMath(s);
  rows.push({
    name: 'Paid Economy + Upgrade',
    pts: u.U, left: s.balance - u.U, net: u.netEV, cpp: u.evPerCommitted,
    score: u.score, fits: u.U <= s.balance,
    cabin: `Business @ ${s.prob}% (else Economy)`, cash: s.econCash, isUpgrade: true,
  });

  const best = rows.filter(r => r.fits && isFinite(r.net)).sort((a, b) => b.score - a.score)[0];
  tb.innerHTML = rows.map(r => `
    <tr class="${r === best ? 'best' : ''}">
      <td>${r.name}${r === best ? ' <span class="chip good">best score</span>' : ''}${r.fits ? '' : ' <span class="chip bad">over balance</span>'}</td>
      <td class="num">${fmtPts(r.pts)}</td>
      <td class="num">${fmtAud(r.cash)}</td>
      <td class="num">${r.left < 0 ? '—' : fmtPts(r.left)}</td>
      <td>${r.cabin}</td>
      <td class="num">${isFinite(r.net) ? fmtAud(r.net) : '—'}${r.isUpgrade ? ' <span class="hint">EV</span>' : ''}</td>
      <td class="num"><span class="chip ${cppClass(r.cpp)}">${fmtCpp(r.cpp)}</span></td>
      <td class="num">${isFinite(r.net) ? fmtAud(r.score) : '—'}</td>
    </tr>`).join('');
}

// ── Render: upgrade panel ──────────────────────────────────────────
function renderUpgrade() {
  const s = state, u = upgradeMath(s), el = $('upgrade-results');
  const eligible = s.fareClass !== 'excluded';
  const biz = rewardRow('business', s.bizCash, s.taxes, s.travellers, s.balance, s.futureCpp / 100);
  const saved = u.ptsBiz - u.U;

  let pText;
  if (!isFinite(u.pStar)) pText = 'Upgrade EV can never match the Business Reward at these values.';
  else if (u.pStar <= 0) pText = 'Upgrade beats the Business Reward on expected value at any P &gt; 0.';
  else if (u.pStar > 1) pText = `Upgrade EV only beats Business Reward if P &gt; ${(u.pStar * 100).toFixed(0)}% — i.e. effectively never at these values.`;
  else pText = `Upgrade beats Business Reward on expected value when P &gt; <b>${(u.pStar * 100).toFixed(0)}%</b>.`;

  el.innerHTML = `
    ${!eligible ? `<div class="row"><span class="chip bad">Fare class not upgrade-eligible</span> Sale fares in E, N, O, Q cannot be upgraded — check the booking class before relying on this path.</div>` : ''}
    ${s.fareClass === 'unknown' ? `<div class="row"><span class="chip warn">Eligibility unknown</span> Confirm the fare class is not E/N/O/Q before counting on an upgrade.</div>` : ''}
    <div class="row">
      <span class="kv">Upgrade cost <b>${fmtPts(u.U)}</b> pts (${fmtPts(u.U / s.sectors / s.travellers)}/pp/sector)</span>
      <span class="kv">Saves <b>${fmtPts(saved)}</b> pts vs Business Reward ≈ <b>${fmtAud(saved * s.futureCpp / 100)}</b> at ${s.futureCpp}¢/pt</span>
      <span class="kv">¢/pt <b>if upgrade clears</b>: <span class="chip ${cppClass(u.cppIfClears)}">${fmtCpp(u.cppIfClears)}</span></span>
      <span class="kv">Business Reward ¢/pt: <span class="chip ${cppClass(biz.cpp)}">${fmtCpp(biz.cpp)}</span></span>
    </div>
    <div class="row">
      <span class="kv">Expected net value: <b>${fmtAud(u.netEV)}</b></span>
      <span class="kv">EV per committed point: <span class="chip ${cppClass(u.evPerCommitted)}">${fmtCpp(u.evPerCommitted)}</span></span>
      <span class="kv">Chance of flying Economy anyway: <b>${100 - s.prob}%</b></span>
    </div>
    <div class="row">${pText}</div>
    <div class="row hint">Outcomes — clears: Business for 2, ${fmtPts(u.U)} pts spent, ${fmtPts(s.balance - u.U)} left · fails: Economy, 0 pts spent, full balance kept. ${eligible ? '' : 'Currently moot — the selected fare class cannot be upgraded.'}</div>`;
}

// ── Render: date checker ───────────────────────────────────────────
const inRange = (d, r) => d >= r[1] && d <= r[2];
const overlaps = (a1, a2, r) => a1 <= r[2] && a2 >= r[1];

function renderDates() {
  const s = state, el = $('date-results');
  if (!s.depart || !s.ret || s.ret < s.depart) {
    el.innerHTML = `<div class="row hint">Pick a departure and return date to check against school holidays and Japan busy periods.</div>`;
    return;
  }
  const lines = [];
  const vic = VIC_HOLIDAYS.filter(r => overlaps(s.depart, s.ret, r));
  const jp = JP_BUSY.filter(r => overlaps(s.depart, s.ret, r));
  const pref = PREFERRED.filter(r => s.depart >= r[1] && s.ret <= r[2]);
  const prefPart = PREFERRED.filter(r => overlaps(s.depart, s.ret, r) && !pref.includes(r));

  if (vic.length) lines.push(`<span class="chip bad">Conflicts:</span> overlaps VIC school holidays — ${vic.map(r => r[0]).join(', ')}.`);
  if (pref.length) lines.push(`<span class="chip good">Preferred:</span> fully inside preferred window ${pref.map(r => r[0]).join(', ')}.`);
  else if (prefPart.length) lines.push(`<span class="chip warn">Partial:</span> touches preferred window ${prefPart.map(r => r[0]).join(', ')} but also sits outside it.`);
  else if (!vic.length) lines.push(`<span class="chip warn">Outside preferred windows</span> — term time, but not inside the priority windows in the brief.`);
  if (jp.length) lines.push(`<span class="chip warn">Japan busy:</span> overlaps ${jp.map(r => r[0]).join(', ')} — expect higher fares/crowds.`);
  if (!vic.length && !jp.length && pref.length) lines.push(`<span class="chip good">Clean window:</span> no school-holiday or Japan-holiday conflicts detected.`);

  el.innerHTML = lines.map(l => `<div class="row">${l}</div>`).join('');
}

// ── Render: candidate flights table ────────────────────────────────
const FARE_OPTS = [
  ['eligible', 'Eligible'], ['flexible', 'Flexible (43.1k)'],
  ['excluded', 'Sale E/N/O/Q — not eligible'], ['unknown', 'Unknown'],
];
const SEAT_OPTS = [[0, '0'], [1, '1'], [2, '2+']];

function newRow() {
  return { id: Math.random().toString(36).slice(2), label: '', route: 'MEL–NRT', econ: '', biz: '', fareClass: 'eligible', bizSeats: 0 };
}
function rowUpgradePtsPerSector(fareClass) {
  if (state.upgradeType === 'custom') return state.upgradeCustom;
  return fareClass === 'flexible' ? UPGRADE_PRESETS.flexible : UPGRADE_PRESETS.paid;
}
function rowComputed(row) {
  const T = state.travellers;
  const econ = parseFloat(row.econ) || 0, biz = parseFloat(row.biz) || 0;
  const bp = REWARD_PTS.business * T, ep = REWARD_PTS.economy * T, u2 = rowUpgradePtsPerSector(row.fareClass) * T * state.sectors;
  const bits = [];
  bits.push(Number(row.bizSeats) >= T ? `Biz reward ${fmtPts(bp)} pts · ${fmtCpp(biz ? (biz - state.taxes) / bp * 100 : NaN)}`
                                      : `Biz reward <span class="chip bad">${row.bizSeats} seats</span>`);
  bits.push(`Econ reward ${fmtPts(ep)} pts · ${fmtCpp(econ ? (econ - state.taxes) / ep * 100 : NaN)}`);
  bits.push(row.fareClass !== 'excluded'
    ? `Upgrade ${fmtPts(u2)} pts · ${fmtCpp(econ && biz ? (biz - econ) / u2 * 100 : NaN)} if clears`
    : `Upgrade <span class="chip bad">n/a — fare excluded</span>`);
  return bits.join('<br>');
}
function renderCandidates() {
  const tb = $('candidates').tBodies[0];
  tb.innerHTML = state.rows.map(r => {
    return `<tr data-id="${r.id}">
      <td><input class="dateish" data-k="label" value="${esc(r.label)}" placeholder="e.g. 10–24 May"></td>
      <td><input data-k="route" value="${esc(r.route)}"></td>
      <td class="num"><input data-k="econ" type="number" min="0" step="50" value="${r.econ}" placeholder="0"></td>
      <td class="num"><input data-k="biz" type="number" min="0" step="50" value="${r.biz}" placeholder="0"></td>
      <td><select data-k="fareClass">${FARE_OPTS.map(([v, l]) => `<option value="${v}" ${v === r.fareClass ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td class="num"><select data-k="bizSeats">${SEAT_OPTS.map(([v, l]) => `<option value="${v}" ${Number(r.bizSeats) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td class="comp">${rowComputed(r)}</td>
      <td><button class="del" data-del="${r.id}">✕</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="hint">No candidate flights yet — add one per itinerary you find on the Qantas site.</td></tr>`;
}
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ── Render: decision guide ─────────────────────────────────────────
function renderDecision() {
  const s = state, T = s.travellers, u = upgradeMath(s);
  const bizPts = REWARD_PTS.business * T, econPts = REWARD_PTS.economy * T;
  const rules = [
    { hit: s.bizSeats >= T,
      t: `<b>A. Business Classic Reward available for all ${T} travellers</b> — strongest candidate: ${fmtPts(bizPts)} pts buys confirmed Business. Book it.` },
    { hit: s.bizSeats < T && s.fareClass !== 'excluded' && s.econCash > 0,
      t: `<b>B. No Business Reward, cheap eligible Economy</b> — investigate ${fmtPts(u.U)}-pt upgrade. ¢/pt if it clears: ${fmtCpp(u.cppIfClears)}. Verify fare class & Business-cabin availability.` },
    { hit: s.bizSeats < T && s.econCash > 0 && u.cppIfClears < 1,
      t: `<b>C. Expensive / poor-value Economy</b> — upgrade ¢/pt under 1¢ even if it clears. Wait for a better date rather than forcing this path.` },
    { hit: s.bizSeats === 1,
      t: `<b>D. Only 1 Business reward seat</b> — don't auto-split cabins. Search ±1–3 days and other Japan airports first.` },
    { hit: s.bizSeats < T && s.econSeats >= T,
      t: `<b>E. Economy Rewards abundant</b> — ${fmtPts(econPts)} pts keeps ${fmtPts(s.balance - econPts)} in the bank for another trip (≈${fmtAud((s.balance - econPts) * s.futureCpp / 100)} at ${s.futureCpp}¢/pt).` },
  ];
  $('decision-list').innerHTML = rules.map(r =>
    `<li class="${r.hit ? 'hit' : 'miss'}"><span class="tag">${r.hit ? '▸' : '·'}</span>${r.t}</li>`).join('')
    + `<li class="miss"><span class="tag">·</span>Timing: Classic Rewards open ~353 days ahead (earlier for status). Search outbound & return separately, ±1–3 days, all Japan airports; seats can appear in batches closer to departure.</li>`;
}

// ── CSV export ─────────────────────────────────────────────────────
function exportCsv() {
  const head = ['label', 'route', 'econ_cash', 'biz_cash', 'fare_class', 'biz_reward_seats',
    'econ_reward_pts', 'biz_reward_pts', 'upgrade_pts', 'biz_cpp', 'econ_cpp', 'upgrade_cpp_if_clears'];
  const T = state.travellers;
  const lines = [head.join(',')];
  for (const r of state.rows) {
    const econ = parseFloat(r.econ) || 0, biz = parseFloat(r.biz) || 0;
    const bp = REWARD_PTS.business * T, ep = REWARD_PTS.economy * T, up2 = rowUpgradePtsPerSector(r.fareClass) * T * state.sectors;
    const row = [r.label, r.route, econ, biz, r.fareClass, r.bizSeats, ep, bp, up2,
      biz ? ((biz - state.taxes) / bp * 100).toFixed(2) : '',
      econ ? ((econ - state.taxes) / ep * 100).toFixed(2) : '',
      (econ && biz) ? ((biz - econ) / up2 * 100).toFixed(2) : ''];
    lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'qff-candidates.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Wiring ─────────────────────────────────────────────────────────
const BIND = [
  ['in-balance', 'balance', 'num'], ['in-travellers', 'travellers', 'num'],
  ['in-sectors', 'sectors', 'num'], ['in-taxes', 'taxes', 'num'],
  ['in-futurecpp', 'futureCpp', 'num'], ['in-econcash', 'econCash', 'num'],
  ['in-premcash', 'premCash', 'num'], ['in-bizcash', 'bizCash', 'num'],
  ['in-upgradetype', 'upgradeType', 'str'], ['in-upgradecustom', 'upgradeCustom', 'num'],
  ['in-fareclass', 'fareClass', 'str'], ['in-prob', 'prob', 'num'],
  ['in-bizseats', 'bizSeats', 'num'], ['in-econseats', 'econSeats', 'num'],
  ['in-depart', 'depart', 'str'], ['in-return', 'ret', 'str'],
];
function renderAll() { renderStrategies(); renderUpgrade(); renderDates(); renderCandidates(); renderDecision(); save(); }

BIND.forEach(([id, key, type]) => {
  const el = $(id);
  el.value = state[key];
  el.addEventListener('input', () => {
    state[key] = type === 'num' ? (parseFloat(el.value) || 0) : el.value;
    if (id === 'in-prob') $('out-prob').textContent = el.value + '%';
    if (id === 'in-upgradetype') $('in-upgradecustom').disabled = el.value !== 'custom';
    renderAll();
  });
});
$('out-prob').textContent = state.prob + '%';
$('in-upgradecustom').disabled = state.upgradeType !== 'custom';

$('candidates').addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-id]'); if (!tr) return;
  const row = state.rows.find(r => r.id === tr.dataset.id); if (!row) return;
  row[e.target.dataset.k] = e.target.dataset.k === 'bizSeats' ? Number(e.target.value) : e.target.value;
  save();
  tr.querySelector('.comp').innerHTML = rowComputed(row);
});
$('candidates').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.del;
  if (!id) return;
  state.rows = state.rows.filter(r => r.id !== id);
  renderAll();
});
$('btn-addrow').addEventListener('click', () => { state.rows.push(newRow()); renderAll(); });
$('btn-csv').addEventListener('click', exportCsv);
$('btn-clear').addEventListener('click', () => {
  if (confirm('Remove all candidate flights?')) { state.rows = []; renderAll(); }
});

renderAll();
