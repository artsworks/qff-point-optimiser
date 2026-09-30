'use strict';
/* UI layer. All maths lives in calc.js (window.QFF). */
const Q = window.QFF;
const LS_KEY = 'qff-optimiser-v2';
const FINDER_URL = 'https://flightrewardfinder.qantas.com/';
const STATUS_WINDOW = { bronze: '24 hours', silver: '24 hours', gold: '24 hours', platinum: '3 days', p1: '7 days' };

const newJourney = (over = {}) => ({
  id: Math.random().toString(36).slice(2, 9),
  label: '', route: 'MEL-NRT', airline: 'qantas', zone: '', oneWay: false,
  depart: '', ret: '',
  econCash: '', econClass: '', upgEconCash: '', peCash: '', peFareType: 'pe', bizCash: '',
  taxEcon: '', taxPremium: '', bizSeats: '', econSeats: '', prob: 50,
  ...over,
});
const DEFAULT_STATE = () => ({
  setup: { balance: 400000, travellers: 2, status: 'bronze', futureCpp: 1, bizWeight: 100 },
  journeys: [newJourney({
    label: 'Example, mid-May 2027 (edit me)', depart: '2027-05-10', ret: '2027-05-24',
    econCash: 2400, bizCash: 10000, taxEcon: 500, taxPremium: 700,
  })],
});

let state = loadState();

function loadState() {
  const fromHash = decodeShare(location.hash);
  if (fromHash) { history.replaceState(null, '', location.pathname); return fromHash; }
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && s.setup && Array.isArray(s.journeys)) return s;
  } catch { /* fall through */ }
  return DEFAULT_STATE();
}
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));
function encodeShare(s) { return '#s=' + btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
function decodeShare(hash) {
  const m = /^#s=(.+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    return s && s.setup && Array.isArray(s.journeys) ? s : null;
  } catch { return null; }
}

// ── Formatting ──
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (n) => isFinite(n) ? Math.round(n).toLocaleString('en-AU') : 'n/a';
const aud = (n) => isFinite(n) ? (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU') : 'n/a';
const cpp = (c) => isFinite(c) ? c.toFixed(2) + '¢' : 'n/a';
const pct = (p) => Math.round(p * 100) + '%';
const cppTone = (c) => !isFinite(c) ? '' : c >= 1.5 ? 'good' : c >= 1 ? 'warn' : 'bad';
const chip = (text, tone = '') => `<span class="chip ${tone}">${text}</span>`;
const fmtDate = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const setupForCalc = () => ({ ...state.setup, bizWeight: (Number(state.setup.bizWeight) || 100) / 100 });

// ── Journey card ──
function cardHtml(j) {
  const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(j[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (k, type = 'number', extra = '') => `<input data-k="${k}" type="${type}" value="${esc(j[k])}" ${extra}>`;
  const T = Number(state.setup.travellers) || 2;
  const seatOpts = [['', 'Not checked'], ...Array.from({ length: T + 1 }, (_, i) => [i, i === T ? `${i}+ (enough)` : String(i)])];
  const zoneOpts = [['', 'Auto from route'], ...Array.from({ length: 10 }, (_, i) => [i + 1, `Zone ${i + 1}`])];
  return `
  <article class="journey" data-id="${j.id}">
    <div class="j-head">
      <input class="j-title" data-k="label" value="${esc(j.label)}" placeholder="Journey name, for example Mid-May Tokyo">
      <div class="j-actions">
        <a class="btn small" href="${FINDER_URL}" target="_blank" rel="noopener">Check reward seats</a>
        <button type="button" class="small" data-act="dup">Duplicate</button>
        <button type="button" class="small danger" data-act="del">Remove</button>
      </div>
    </div>
    <div class="j-verdict"></div>
    <details class="j-inputs" ${j.bizCash || j.econCash ? '' : 'open'}>
      <summary>Edit details</summary>
      <fieldset><legend>Trip</legend><div class="grid inputs">
        <label>Route (one way) <span class="hint">airport codes, for example MEL-NRT or MEL-SYD-HND</span>${inp('route', 'text')}</label>
        <label>Airline${sel('airline', [['qantas', 'Qantas, Jetstar or American Airlines'], ['partner', 'Partner airline, such as Japan Airlines']])}</label>
        <label>Zone${sel('zone', zoneOpts)}</label>
        <label>Trip type${sel('oneWay', [['false', 'Return'], ['true', 'One way']])}</label>
        <label>Depart${inp('depart', 'date')}</label>
        <label>Return${inp('ret', 'date')}</label>
      </div></fieldset>
      <fieldset><legend>Cash fares for all travellers, whole trip</legend><div class="grid inputs">
        <label>Cheapest Economy $${inp('econCash', 'number', 'min="0" step="50"')}</label>
        <label>Business $${inp('bizCash', 'number', 'min="0" step="50"')}</label>
        <label>Premium Economy $ <span class="hint">optional</span>${inp('peCash', 'number', 'min="0" step="50"')}</label>
        <label>Upgradeable Economy $ <span class="hint">if it costs more than the cheapest</span>${inp('upgEconCash', 'number', 'min="0" step="50" placeholder="same as cheapest"')}</label>
        <label>Economy fare class <span class="hint">letter shown at booking</span>${inp('econClass', 'text', 'maxlength="1" placeholder="for example L"')}</label>
        <label>Premium Economy fare type${sel('peFareType', [['discPE', 'Discount PE'], ['pe', 'Premium Economy'], ['flexPE', 'Flexible PE']])}</label>
      </div></fieldset>
      <fieldset><legend>From the Flight Reward finder</legend><div class="grid inputs">
        <label>Business reward seats${sel('bizSeats', seatOpts)}</label>
        <label>Economy reward seats${sel('econSeats', seatOpts)}</label>
        <label>Taxes on Economy reward $ <span class="hint">total</span>${inp('taxEcon', 'number', 'min="0" step="10"')}</label>
        <label>Taxes on Business or PE reward $ <span class="hint">total</span>${inp('taxPremium', 'number', 'min="0" step="10"')}</label>
        <label class="wide">Chance the upgrade clears for everyone, both ways
          <div class="sliderrow"><input data-k="prob" type="range" min="0" max="100" step="5" value="${esc(j.prob)}"><output class="o-prob">${esc(j.prob)}%</output></div>
          <span class="hint">Qantas doesn't publish odds. Try a few values and see if the verdict changes.</span>
        </label>
      </div></fieldset>
    </details>
    <div class="j-flags"></div>
    <div class="tablewrap"><table class="j-table">
      <thead><tr><th>Option</th><th class="num">Points</th><th class="num">Cash</th><th>You fly</th><th class="num">Cents per point</th><th class="num">Gain</th><th></th></tr></thead>
      <tbody></tbody>
    </table></div>
  </article>`;
}

function evalJourney(j) {
  return Q.evaluate(setupForCalc(), { ...j, oneWay: String(j.oneWay) === 'true' });
}

function verdictHtml(j, r) {
  const f = Number(state.setup.futureCpp) || 0;
  const T = r.T;
  if (!r.strategies.length) return `<p class="hint">Enter at least the Economy and Business cash fares to see a verdict.</p>`;
  const b = r.best;
  if (!b) return `<p>${chip('No workable option', 'bad')} No option fits your balance with the seats and fare class you entered.</p>`;
  const lines = [];
  lines.push(`<p class="big"><b>Best option is ${b.name}.</b> It costs ${b.points ? pts(b.points) + ' points and ' : ''}${aud(b.cash)} cash${b.points ? `, gets ${cpp(b.cpp)} per point` : ''}, and gains you ${aud(b.gain)}.</p>`);
  const runner = r.ranked[1];
  if (runner) lines.push(`<p>Next best is ${runner.name}, which gains ${aud(runner.gain)} (${aud(b.gain - runner.gain)} less).</p>`);
  if (b.available === 'unknown') lines.push(`<p>${chip('Check seats', 'warn')} Confirm there are ${T} seats on the <a href="${FINDER_URL}" target="_blank" rel="noopener">Flight Reward finder</a> before you rely on this.</p>`);

  const c = r.compare, upg = r.strategies.find((s) => s.key === 'econUpgrade');
  if (c && upg && upg.eligible !== false) {
    lines.push(`<p>Compared with the Business Classic Reward, the upgrade route uses ${pts(c.savedPts)} fewer points and costs ${aud(c.extraCash)} more cash. That is the same as buying points at ${cpp(c.impliedCpp)} each, and you value them at ${f}¢. ${breakevenText(c)}</p>`);
  }
  return lines.join('');
}
function breakevenText(c) {
  const p = c.breakevenP;
  if (!isFinite(p)) return '';
  const winsAt = (P) => c.upgradeBetterAbove ? P > p : P < p;
  const w0 = winsAt(0), w1 = winsAt(1);
  if (w0 && w1) return 'It beats the Business Classic Reward at any odds.';
  if (!w0 && !w1) return 'It can\'t beat the Business Classic Reward, even if the upgrade is certain to clear.';
  if (w1) return `It beats the Business Classic Reward only if the chance of the upgrade clearing is above ${pct(p)}.`;
  return `It wins only when the chance is below ${pct(p)}, because the better result is flying Economy and keeping your points.`;
}

function flagsHtml(j, r) {
  const out = [];
  if (r.unknownAirports.length) out.push(chip(`Unknown airport ${r.unknownAirports.join(', ')}. Set the zone manually.`, 'bad'));
  if (isFinite(r.miles)) out.push(chip(`${r.codes.join('-')} is about ${pts(r.miles)} miles, Zone ${r.zone}${j.zone ? ' (set manually)' : ''}`));
  else if (isFinite(r.zone)) out.push(chip(`Zone ${r.zone} (set manually)`));
  if (r.nearBoundary && !j.zone) out.push(chip('Close to a zone limit. Check the points price on Qantas.', 'warn'));
  if (j.econClass || r.strategies.some((s) => s.key === 'econUpgrade')) {
    if (r.fareClass === 'excluded') out.push(chip(`Class ${esc(j.econClass.toUpperCase())} can't be upgraded`, 'bad'));
    else if (r.fareClass === 'unknown') out.push(chip('Enter the Economy fare class to confirm upgrade eligibility', 'warn'));
    else out.push(chip(`Class ${esc(j.econClass.toUpperCase())} upgradeable${r.fareClass === 'flexEcon' ? ' (flexible fare, 43,100 per person per flight)' : ''}`, 'good'));
  }
  const d = Q.checkDates(j.depart, String(j.oneWay) === 'true' ? '' : j.ret);
  if (d) {
    out.push(chip(`${fmtDate(j.depart)}${j.ret && String(j.oneWay) !== 'true' ? ' to ' + fmtDate(j.ret) + `, ${d.nights} nights` : ''}`));
    d.vic.forEach((h) => out.push(chip(`Clashes with ${h}`, 'bad')));
    d.jp.forEach((h) => out.push(chip(`Busy in Japan (${h})`, 'warn')));
    if (d.preferred) out.push(chip(`Inside the ${d.preferred} window`, 'good'));
    else if (!d.vic.length) out.push(chip('Outside the preferred windows', 'warn'));
    d.seasons.forEach(([s, tone]) => out.push(chip(s, tone === 'info' ? '' : tone)));
    if (!d.covered) out.push(chip('Holiday data only covers 2027', 'warn'));
    const today = new Date().toISOString().slice(0, 10);
    const opens = (iso, what) => iso <= today ? `${what} bookable now` : `${what} opens about ${fmtDate(iso)}`;
    out.push(chip(opens(d.outboundOpens, 'Outbound') + (d.returnOpens ? ', ' + opens(d.returnOpens, 'return') : '')));
  }
  const status = state.setup.status || 'bronze';
  if (r.strategies.some((s) => s.key.endsWith('Upgrade'))) out.push(chip(`At your status, Qantas decides upgrades up to ${STATUS_WINDOW[status]} before departure`));
  return out.join(' ');
}

function tableHtml(r) {
  return r.strategies.map((s) => {
    const tags = [];
    if (s === r.best) tags.push(chip('best', 'good'));
    if (!s.fits) tags.push(chip('over balance', 'bad'));
    if (s.available === 'no') tags.push(chip('not enough seats', 'bad'));
    if (s.available === 'unknown' && s.points) tags.push(chip('check seats', 'warn'));
    if (s.eligible === false) tags.push(chip('fare not eligible', 'bad'));
    if (s.key === 'peUpgrade') tags.push(chip('needs PE on the plane', 'warn'));
    const upg = s.key.endsWith('Upgrade');
    return `<tr class="${s === r.best ? 'best' : ''} ${s.ok ? '' : 'dim'}">
      <td>${s.name}</td>
      <td class="num">${s.points ? pts(s.points) : '0'}${upg ? `<br><span class="hint">${pts(s.perSector)} per person per flight, charged only if it clears</span>` : ''}</td>
      <td class="num">${aud(s.cash)}</td>
      <td>${s.cabin}</td>
      <td class="num">${s.points ? chip(cpp(s.cpp), cppTone(s.cpp)) : 'n/a'}${upg ? '<br><span class="hint">if it clears</span>' : ''}</td>
      <td class="num"><b>${aud(s.gain)}</b></td>
      <td>${tags.join(' ')}</td>
    </tr>`;
  }).join('');
}

function updateCard(j) {
  const el = document.querySelector(`.journey[data-id="${j.id}"]`);
  if (!el) return;
  const r = evalJourney(j);
  $('.j-verdict', el).innerHTML = verdictHtml(j, r);
  $('.j-flags', el).innerHTML = flagsHtml(j, r);
  $('.j-table tbody', el).innerHTML = tableHtml(r);
  $('.o-prob', el).textContent = j.prob + '%';
}

function renderRanking() {
  const rows = state.journeys.map((j, i) => ({ j, i, r: evalJourney(j), d: Q.checkDates(j.depart, j.ret) }));
  rows.sort((a, b) => (b.r.best ? b.r.best.gain : -Infinity) - (a.r.best ? a.r.best.gain : -Infinity));
  $('#ranking tbody').innerHTML = rows.map(({ j, r, d }, n) => {
    const b = r.best;
    const flags = [];
    if (d && d.vic.length) flags.push(chip('school hols', 'bad'));
    if (d && d.jp.length) flags.push(chip('busy in Japan', 'warn'));
    if (b && b.available === 'unknown' && b.points) flags.push(chip('check seats', 'warn'));
    if (b && b.key.endsWith('Upgrade')) flags.push(chip(`${pct(b.prob)} upgrade chance`, 'warn'));
    return `<tr data-goto="${j.id}" class="${n === 0 && b ? 'best' : ''}">
      <td>${n + 1}</td><td><a href="#" data-goto="${j.id}">${esc(j.label || 'Untitled journey')}</a><br><span class="hint">${esc(r.codes.join('-'))}</span></td>
      <td>${d ? fmtDate(j.depart) + (j.ret ? ' to ' + fmtDate(j.ret) : '') : '<span class="hint">no dates</span>'}</td>
      <td>${b ? b.name : '<span class="hint">need fares</span>'}</td>
      <td class="num">${b ? pts(b.points) : 'n/a'}</td><td class="num">${b ? aud(b.cash) : 'n/a'}</td>
      <td class="num">${b && b.points ? chip(cpp(b.cpp), cppTone(b.cpp)) : 'n/a'}</td>
      <td class="num"><b>${b ? aud(b.gain) : 'n/a'}</b></td><td>${flags.join(' ')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" class="hint">No journeys yet.</td></tr>`;
}

function renderAll() {
  const box = $('#journeys');
  box.innerHTML = state.journeys.map(cardHtml).join('');
  state.journeys.forEach(updateCard);
  renderRanking();
  save();
}

// ── Setup wiring ──
const SETUP_FIELDS = [['s-balance', 'balance'], ['s-travellers', 'travellers'], ['s-status', 'status'],
  ['s-futurecpp', 'futureCpp'], ['s-bizweight', 'bizWeight']];
SETUP_FIELDS.forEach(([id, key]) => {
  const el = document.getElementById(id);
  el.value = state.setup[key];
  el.addEventListener('input', () => {
    state.setup[key] = el.type === 'number' || el.type === 'range' ? (parseFloat(el.value) || 0) : el.value;
    $('#o-bizweight').textContent = state.setup.bizWeight + '%';
    if (key === 'travellers') renderAll();
    else { state.journeys.forEach(updateCard); renderRanking(); save(); }
  });
});
$('#o-bizweight').textContent = state.setup.bizWeight + '%';

// ── Journey wiring ──
const journeyOf = (el) => {
  const card = el.closest('.journey');
  return card ? state.journeys.find((j) => j.id === card.dataset.id) : null;
};
$('#journeys').addEventListener('input', (e) => {
  const k = e.target.dataset.k, j = journeyOf(e.target);
  if (!k || !j) return;
  j[k] = e.target.value;
  updateCard(j); renderRanking(); save();
});
$('#journeys').addEventListener('click', (e) => {
  const act = e.target.dataset.act, j = journeyOf(e.target);
  if (!act || !j) return;
  if (act === 'del' && confirm(`Remove "${j.label || 'this journey'}"?`)) state.journeys = state.journeys.filter((x) => x !== j);
  if (act === 'dup') {
    const i = state.journeys.indexOf(j);
    state.journeys.splice(i + 1, 0, { ...j, id: newJourney().id, label: (j.label || 'Journey') + ' (copy)' });
  }
  renderAll();
});
$('#ranking').addEventListener('click', (e) => {
  const id = e.target.closest('[data-goto]')?.dataset.goto;
  if (!id) return;
  e.preventDefault();
  document.querySelector(`.journey[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#btn-add').addEventListener('click', () => {
  state.journeys.push(newJourney({ label: `Journey ${state.journeys.length + 1}` }));
  renderAll();
  document.querySelector('.journey:last-child')?.scrollIntoView({ behavior: 'smooth' });
});
$('#btn-reset').addEventListener('click', () => {
  if (confirm('Reset everything to the example?')) { state = DEFAULT_STATE(); SETUP_FIELDS.forEach(([id, k]) => { document.getElementById(id).value = state.setup[k]; }); renderAll(); }
});
function toast(msg) { const t = $('#toast'); t.textContent = msg; setTimeout(() => { t.textContent = ''; }, 2500); }
$('#btn-share').addEventListener('click', async () => {
  const url = location.origin + location.pathname + encodeShare(state);
  try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone who opens it sees your journeys.'); }
  catch { prompt('Copy this link:', url); }
});
$('#btn-csv').addEventListener('click', () => {
  const head = ['journey', 'route', 'depart', 'return', 'zone', 'option', 'points', 'expected_points', 'cash', 'cpp', 'gain', 'usable'];
  const lines = [head.join(',')];
  for (const j of state.journeys) {
    const r = evalJourney(j);
    for (const s of r.strategies) {
      lines.push([j.label, r.codes.join('-'), j.depart, j.ret, r.zone, s.name, s.points, Math.round(s.expPoints),
        Math.round(s.cash), isFinite(s.cpp) ? s.cpp.toFixed(2) : '', Math.round(s.gain), s.ok ? 'yes' : 'no']
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'qff-journeys.csv'; a.click(); URL.revokeObjectURL(a.href);
});

renderAll();
