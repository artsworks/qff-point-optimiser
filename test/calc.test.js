'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../calc.js');

const setup = { balance: 400000, travellers: 2, futureCpp: 0, bizWeight: 1 };
const base = { route: 'MEL-NRT', airline: 'qantas', econCash: 1200, bizCash: 5000,
  econClass: 'L', taxEcon: 0, taxPremium: 0, prob: 100 };
const get = (r, k) => r.strategies.find((s) => s.key === k);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('MEL–NRT is Zone 6', () => {
  const d = Q.routeMiles('MEL-NRT');
  assert.ok(d.miles > 4800 && d.miles <= 5800, String(d.miles));
  assert.equal(Q.zoneFor(d.miles), 6);
});

test('connections are summed per trip', () => {
  const direct = Q.routeMiles('MEL-HND').miles, via = Q.routeMiles('MEL SYD HND').miles;
  assert.ok(via > direct);
  assert.equal(Q.zoneFor(Q.routeMiles('BNE-NRT').miles), 5);
  assert.ok(Q.nearZoneBoundary(Q.routeMiles('MEL-SYD-CTS').miles));
});

test('brief totals: 144,800 / 393,600 / 314,000 / 79,600', () => {
  const r = Q.evaluate(setup, base);
  assert.equal(get(r, 'econReward').points, 144800);
  assert.equal(get(r, 'bizReward').points, 393600);
  assert.equal(get(r, 'econUpgrade').points, 314000);
  assert.equal(r.compare.savedPts, 79600);
  assert.equal(get(r, 'mixedReward').points, (98400 + 36200) * 2);
});

test('brief upgrade example: $3,800 / 314,000 ≈ 1.21¢', () => {
  const r = Q.evaluate(setup, base);
  close(get(r, 'econUpgrade').cpp, 3800 / 314000 * 100);
  assert.equal(get(r, 'econUpgrade').cpp.toFixed(2), '1.21');
});

test('Business Reward CPP = (cash − taxes) / points', () => {
  const r = Q.evaluate(setup, { ...base, taxPremium: 600 });
  close(get(r, 'bizReward').cpp, (5000 - 600) / 393600 * 100);
});

test('points only count as spent with probability P', () => {
  const r = Q.evaluate({ ...setup, futureCpp: 1 }, { ...base, prob: 40 });
  const u = get(r, 'econUpgrade');
  close(u.expPoints, 0.4 * 314000);
  close(u.value, 0.4 * 5000 + 0.6 * 1200);
  close(u.gain, 0.4 * (5000 - 1200) - 0.4 * 314000 * 0.01);
});

test('P = 0 upgrade equals just buying Economy', () => {
  const r = Q.evaluate({ ...setup, futureCpp: 1.5 }, { ...base, prob: 0 });
  close(get(r, 'econUpgrade').gain, get(r, 'cashEcon').gain);
});

test('break-even P* makes upgrade gain equal Business Reward gain', () => {
  const s = { ...setup, futureCpp: 1.5 };
  const j = { ...base, econCash: 1400, bizCash: 9000, taxPremium: 500 };
  const pStar = Q.evaluate(s, j).compare.breakevenP;
  assert.ok(pStar > 0 && pStar < 1, String(pStar));
  const r = Q.evaluate(s, { ...j, prob: pStar * 100 });
  close(get(r, 'econUpgrade').gain, get(r, 'bizReward').gain, 1e-6);
});

test('implied price of saved points = extra cash / saved points', () => {
  const r = Q.evaluate(setup, { ...base, taxPremium: 600 });
  close(r.compare.impliedCpp, (1200 - 600) / 79600 * 100);
});

test('fare classes: GKLMSV eligible, BHY flexible, others excluded', () => {
  for (const c of 'GKLMSV') assert.equal(Q.fareClassType(c), 'econ');
  for (const c of 'BHY') assert.equal(Q.fareClassType(c), 'flexEcon');
  for (const c of 'ENOQ') assert.equal(Q.fareClassType(c), 'excluded');
  assert.equal(Q.fareClassType(''), 'unknown');
  const flex = Q.evaluate(setup, { ...base, econClass: 'Y' });
  assert.equal(get(flex, 'econUpgrade').points, 43100 * 4);
  const sale = Q.evaluate(setup, { ...base, econClass: 'O' });
  assert.equal(get(sale, 'econUpgrade').ok, false);
});

test('Premium Economy + upgrade uses 39,200 pp/sector', () => {
  const r = Q.evaluate(setup, { ...base, peCash: 3000, peFareType: 'pe' });
  assert.equal(get(r, 'peUpgrade').points, 39200 * 4);
});

test('partner table (e.g. JAL) Business Zone 6 = 108,000 one-way', () => {
  const r = Q.evaluate(setup, { ...base, airline: 'partner' });
  assert.equal(get(r, 'bizReward').points, 108000 * 4);
});

test('one-way halves points', () => {
  const r = Q.evaluate(setup, { ...base, oneWay: true });
  assert.equal(get(r, 'bizReward').points, 98400 * 2);
  assert.equal(get(r, 'mixedReward'), undefined);
});

test('over-balance and unavailable options are never "best"', () => {
  const r = Q.evaluate({ ...setup, balance: 300000 }, base);
  assert.equal(get(r, 'bizReward').ok, false);
  const r2 = Q.evaluate(setup, { ...base, bizSeats: 1 });
  assert.equal(get(r2, 'bizReward').available, 'no');
  assert.notEqual(r2.best.key, 'bizReward');
});

test('date checks: VIC holidays, Golden Week, preferred window, booking opens', () => {
  const a = Q.checkDates('2027-05-10', '2027-05-24');
  assert.deepEqual(a.vic, []); assert.deepEqual(a.jp, []);
  assert.equal(a.preferred, '12 Apr to 25 Jun');
  assert.equal(a.outboundOpens, '2026-05-22');
  const b = Q.checkDates('2027-04-05', '2027-05-01');
  assert.deepEqual(b.vic, ['VIC autumn holidays']);
  assert.deepEqual(b.jp, ['Golden Week']);
  assert.equal(b.preferred, null);
});

test('simpleCompare: two people return MEL-NRT', () => {
  const r = Q.simpleCompare({ balance: 400000, travellers: 2, oneWay: false, route: 'MEL-NRT',
    econCash: 2400, bizCash: 10000, tax: 700 });
  const get2 = (k) => r.options.find((o) => o.key === k);
  assert.equal(r.zone, 6);
  assert.equal(get2('bizReward').points, 393600);
  assert.equal(get2('econReward').points, 144800);
  assert.equal(get2('econUpgrade').points, 314000);
  assert.equal(get2('bizReward').left, 6400);
  assert.equal(r.best.key, 'bizReward');
});
