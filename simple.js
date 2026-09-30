(() => {
  const Q = window.PTS;
  const LS_KEY = 'points-simple-v1';
  const DEFAULTS = { balance: 100000, travellers: 1, oneway: 'false', route: 'MEL-NRT', econ: 1200, biz: 5000, tax: 350 };
  const $ = (s) => document.querySelector(s);
  const pts = (n) => Math.round(n).toLocaleString('en-AU');
  const aud = (n) => '$' + Math.round(n).toLocaleString('en-AU');
  const cpp = (n) => (isFinite(n) ? n.toFixed(2) + '¢' : 'n/a');

  const rating = (c) => {
    if (!isFinite(c) || c <= 0) return ['Poor', 'bad'];
    if (c >= 2) return ['Great', 'good'];
    if (c >= 1.5) return ['Good', 'good'];
    if (c >= 1) return ['Fair', 'warn'];
    return ['Poor', 'bad'];
  };

  let state;
  try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY)) }; } catch { state = { ...DEFAULTS }; }

  const fields = ['balance', 'travellers', 'oneway', 'route', 'econ', 'biz', 'tax'];
  fields.forEach((f) => {
    const el = $('#s-' + f);
    el.value = state[f];
    el.addEventListener('input', () => {
      state[f] = el.value;
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      render();
    });
  });

  function card(o, best) {
    const [label, cls] = rating(o.cpp);
    const isBest = best && best.key === o.key;
    const cashWord = o.key === 'econUpgrade' ? 'Economy fare' : 'taxes';
    const lines = [
      `<div class="opt-pts">${pts(o.points)} points</div>`,
      `<div>plus ${aud(o.cash)} ${cashWord}</div>`,
      `<div>${cpp(o.cpp)} per point <span class="chip ${cls}">${label}</span></div>`,
      o.affordable
        ? `<div class="muted">${pts(o.left)} points left</div>`
        : `<div class="bad-text">You need ${pts(-o.left)} more points</div>`,
    ];
    if (o.key === 'econUpgrade') lines.push('<div class="muted">Business only if the upgrade clears. If it doesn\'t, you fly Economy and keep the points.</div>');
    if (o.key === 'bizReward') lines.push('<div class="muted">Business is confirmed when you book. Needs a reward seat for every traveller.</div>');
    if (o.key === 'econReward') lines.push('<div class="muted">Uses the fewest points. Needs a reward seat for every traveller.</div>');
    return `<div class="opt${isBest ? ' best' : ''}"><h3>${o.name}${isBest ? ' <span class="chip good">Best</span>' : ''}</h3>${lines.join('')}</div>`;
  }

  function render() {
    const r = Q.simpleCompare({
      balance: state.balance, travellers: state.travellers, oneWay: state.oneway === 'true',
      route: state.route, econCash: state.econ, bizCash: state.biz, tax: state.tax,
    });
    $('#s-options').innerHTML = r.options.map((o) => card(o, r.best)).join('');
    const biz = r.options[0], upg = r.options[2];
    let msg;
    if (!r.best) {
      msg = 'Enter both cash prices to see a result.';
    } else {
      const verb = { bizReward: 'Book the Business reward', econReward: 'Book the Economy reward', econUpgrade: 'Buy the Economy fare and upgrade with points' }[r.best.key];
      msg = `<b>${verb}</b> if seats are available. It gets ${cpp(r.best.cpp)} per point.`;
      if (r.best.key === 'econUpgrade') {
        msg += ' The upgrade might not clear, so be comfortable flying Economy.';
      } else if (r.best.key === 'bizReward' && upg.affordable) {
        const extra = upg.cash - biz.cash;
        msg += ` The upgrade saves ${pts(biz.points - upg.points)} points but costs ${aud(extra)} more cash, and Business isn't guaranteed.`;
      }
    }
    $('#s-answer').innerHTML = `<p class="big">${msg}</p><p class="muted">Reward zone ${r.zone}. Prices are for ${state.travellers} ${Number(state.travellers) === 1 ? 'traveller' : 'travellers'}, ${state.oneway === 'true' ? 'one way' : 'return'}.</p>`;
  }

  render();
})();
