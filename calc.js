'use strict';
/* Pure calculation engine — no DOM. Loaded by index.html and by node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QFF = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Qantas tables, bookings/requests from 5 Aug 2025. Points per passenger, ONE-WAY.
  const ZONE_MAX_MILES = [600, 1200, 2400, 3600, 4800, 5800, 7000, 8400, 9600, 15000];
  // [economy, premium, business, first]
  const QF_REWARD = [
    [9200, 14500, 19300, 29000], [13800, 21600, 29000, 43600], [20700, 32600, 43600, 65300],
    [23300, 50600, 68400, 102600], [29000, 61600, 82100, 123100], [36200, 73800, 98400, 147700],
    [43200, 85300, 113900, 170800], [48200, 97600, 130100, 195400], [58900, 113900, 151800, 227800],
    [63500, 124700, 166300, 249400],
  ];
  const PARTNER_REWARD = [
    [11500, 16600, 21000, 30500], [16100, 24900, 31500, 45700], [23000, 36200, 46000, 67700],
    [28200, 58200, 73400, 107800], [34700, 70800, 90000, 129200], [43500, 85000, 108000, 155200],
    [51800, 98200, 125400, 179800], [57800, 112200, 143000, 205000], [70700, 130800, 167000, 239200],
    [76100, 143500, 182900, 261600],
  ];
  // International Classic Upgrade to Business, per passenger per flight (one-way).
  // [fromEconomyReward, economy, flexibleEconomy, fromPEReward, discountPE, premiumEconomy, flexiblePE]
  const UPG_TO_BUSINESS = [
    [14300, 12000, 6500, 8400, 6500, 5900, 5400], [21600, 17900, 10100, 12500, 10100, 8900, 7700],
    [31100, 24000, 13100, 19100, 13100, 12000, 10800], [41900, 36000, 19700, 27000, 19700, 17900, 16200],
    [70600, 65400, 35900, 47000, 35900, 32600, 29400], [83600, 78500, 43100, 52300, 43100, 39200, 35300],
    [104600, 91600, 50400, 70600, 50400, 45800, 41200], [130800, 117700, 64800, 88200, 64800, 58900, 52900],
    [143900, 130800, 72000, 98000, 72000, 65400, 58800], [162100, 157000, 86300, 111100, 86300, 78500, 70600],
  ];
  const UPG_COL = { rewardEcon: 0, econ: 1, flexEcon: 2, rewardPE: 3, discPE: 4, pe: 5, flexPE: 6 };

  // International economy booking classes for Classic Upgrade eligibility.
  const ECON_UPGRADE_CLASSES = 'GKLMSV';
  const FLEX_ECON_CLASSES = 'BHY';

  const AIRPORTS = {
    MEL: [-37.669, 144.841], SYD: [-33.9399, 151.1753], BNE: [-27.3842, 153.1175],
    ADL: [-34.945, 138.5306], PER: [-31.9403, 115.9669], CNS: [-16.8858, 145.7553],
    DRW: [-12.4147, 130.8767], OOL: [-28.1644, 153.5047],
    NRT: [35.7647, 140.3864], HND: [35.5523, 139.7797], KIX: [34.4273, 135.244],
    ITM: [34.7855, 135.4382], NGO: [34.8584, 136.8054], FUK: [33.5859, 130.4511],
    CTS: [42.7752, 141.6923], OKA: [26.1958, 127.6459], HIJ: [34.4361, 132.9194],
    SDJ: [38.1397, 140.917], KOJ: [31.8034, 130.7194], KMJ: [32.8373, 130.8551],
    SIN: [1.3644, 103.9915], HKG: [22.308, 113.9185], MNL: [14.5086, 121.0194],
    TPE: [25.0777, 121.2328], ICN: [37.4602, 126.4407],
  };

  // ── Distance / zone ──
  function greatCircleMiles(a, b) {
    const r = (x) => x * Math.PI / 180, R = 3958.8;
    const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 +
      Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function parseRoute(route) {
    return String(route || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  }
  function routeMiles(route) {
    const codes = parseRoute(route);
    const unknown = codes.filter((c) => !AIRPORTS[c]);
    if (codes.length < 2 || unknown.length) return { codes, miles: NaN, unknown };
    let miles = 0;
    for (let i = 1; i < codes.length; i++) miles += greatCircleMiles(AIRPORTS[codes[i - 1]], AIRPORTS[codes[i]]);
    return { codes, miles: Math.round(miles), unknown };
  }
  function zoneFor(miles) {
    if (!isFinite(miles)) return NaN;
    const i = ZONE_MAX_MILES.findIndex((m) => miles <= m);
    return i === -1 ? NaN : i + 1;
  }
  /** Within `pct` of a zone boundary → our estimate could land in the neighbouring zone. */
  function nearZoneBoundary(miles, pct = 0.03) {
    if (!isFinite(miles)) return false;
    return ZONE_MAX_MILES.some((m) => Math.abs(miles - m) <= m * pct);
  }

  function rewardPts(zone, airline) {
    const row = (airline === 'partner' ? PARTNER_REWARD : QF_REWARD)[zone - 1];
    return row ? { economy: row[0], premium: row[1], business: row[2], first: row[3] } : null;
  }
  function upgradePts(zone, from) {
    const row = UPG_TO_BUSINESS[zone - 1];
    return row ? row[UPG_COL[from]] : NaN;
  }
  /** Classify a paid international Economy booking-class letter for upgrades. */
  function fareClassType(letter) {
    const c = String(letter || '').trim().toUpperCase().slice(0, 1);
    if (!c) return 'unknown';
    if (ECON_UPGRADE_CLASSES.includes(c)) return 'econ';
    if (FLEX_ECON_CLASSES.includes(c)) return 'flexEcon';
    return 'excluded';
  }

  // ── Strategy evaluation ──
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : NaN; };
  const pos = (v) => { const n = num(v); return n > 0 ? n : NaN; };

  /**
   * setup: { balance, travellers, futureCpp (¢), bizWeight (0..1) }
   * j: { route, airline ('qantas'|'partner'), oneWay, zone (override, optional),
   *      econCash, upgEconCash, econClass, peCash, peFareType, bizCash,
   *      taxEcon, taxPremium, bizSeats, econSeats, prob (0..100) }
   * All cash amounts are totals for the whole party for the whole trip.
   */
  function evaluate(setup, j) {
    const T = Math.max(1, Math.round(num(setup.travellers) || 1));
    const S = j.oneWay ? 1 : 2;
    const balance = num(setup.balance) || 0;
    const f = (num(setup.futureCpp) || 0) / 100;
    const w = isFinite(num(setup.bizWeight)) ? num(setup.bizWeight) : 1;
    const P = Math.min(1, Math.max(0, (num(j.prob) || 0) / 100));

    const dist = routeMiles(j.route);
    const zone = num(j.zone) > 0 ? num(j.zone) : zoneFor(dist.miles);
    const pts = rewardPts(zone, j.airline);
    const E = pos(j.econCash), Eu = pos(j.upgEconCash) || E, PE = pos(j.peCash), B = pos(j.bizCash);
    const VB = B * w;                               // value you place on the Business trip
    const tE = num(j.taxEcon) || 0, tP = num(j.taxPremium) || 0;
    const seats = (v) => (v === '' || v === null || v === undefined || !isFinite(num(v))) ? null : num(v);
    const bizSeats = seats(j.bizSeats), econSeats = seats(j.econSeats);
    const avail = (n) => n === null ? 'unknown' : n >= T ? 'yes' : 'no';

    const out = [];
    const add = (s) => {
      s.fits = s.points <= balance;
      s.expPoints = s.expPoints ?? s.points;
      s.leftover = balance - s.points;
      s.net = s.value - s.cash;                                   // travel value − cash out
      s.gain = s.net - s.expPoints * f;                           // vs. buying Economy, keeping points
      s.cpp = s.cppOverride ?? (s.points > 0 ? (s.value - s.cash) / s.points * 100 : NaN);
      s.ok = s.fits && isFinite(s.gain) && s.available !== 'no' && s.eligible !== false;
      out.push(s);
    };

    if (pts) {
      if (E) add({ key: 'econReward', name: 'Economy Classic Reward', points: pts.economy * T * S,
        cash: tE, value: E, cabin: 'Economy (confirmed)', available: avail(econSeats) });
      if (PE) add({ key: 'peReward', name: 'Premium Economy Classic Reward', points: pts.premium * T * S,
        cash: tP, value: PE, cabin: 'Premium Economy (confirmed)', available: 'unknown' });
      if (B) add({ key: 'bizReward', name: 'Business Classic Reward', points: pts.business * T * S,
        cash: tP, value: VB, cabin: 'Business (confirmed)', available: avail(bizSeats) });
      if (B && E && S === 2) add({ key: 'mixedReward', name: 'Business one way + Economy other way (rewards)',
        points: (pts.business + pts.economy) * T, cash: (tP + tE) / 2, value: (VB + E) / 2,
        cabin: 'Business ×1, Economy ×1 (confirmed)',
        available: avail(bizSeats === null || econSeats === null ? null : Math.min(bizSeats, econSeats)) });
    }

    // Paid Economy + Classic Upgrade to Business
    const cls = fareClassType(j.econClass);
    if (B && Eu && isFinite(zone)) {
      const from = cls === 'flexEcon' ? 'flexEcon' : 'econ';
      const U = upgradePts(zone, from) * T * S;
      const vFail = E || Eu;
      add({ key: 'econUpgrade', name: 'Paid Economy + upgrade to Business', points: U, expPoints: P * U,
        cash: Eu, value: P * VB + (1 - P) * vFail, cppOverride: (VB - Eu) / U * 100,
        cabin: `Business if it clears (${Math.round(P * 100)}%), else Economy`,
        eligible: cls !== 'excluded', fareClass: cls, prob: P, upgradeFrom: from, perSector: U / T / S });
    }
    // Paid Premium Economy + Classic Upgrade to Business
    if (B && PE && isFinite(zone)) {
      const from = ['discPE', 'pe', 'flexPE'].includes(j.peFareType) ? j.peFareType : 'pe';
      const U = upgradePts(zone, from) * T * S;
      add({ key: 'peUpgrade', name: 'Paid Premium Economy + upgrade to Business', points: U, expPoints: P * U,
        cash: PE, value: P * VB + (1 - P) * PE, cppOverride: (VB - PE) / U * 100,
        cabin: `Business if it clears (${Math.round(P * 100)}%), else Premium Economy`,
        prob: P, upgradeFrom: from, perSector: U / T / S });
    }
    if (B) add({ key: 'cashBiz', name: 'Pay cash for Business', points: 0, cash: B, value: VB,
      cabin: 'Business (confirmed)', cppOverride: NaN });
    if (E) add({ key: 'cashEcon', name: 'Pay cash for Economy (keep all points)', points: 0, cash: E, value: E,
      cabin: 'Economy (confirmed)', cppOverride: NaN });

    const ranked = out.filter((s) => s.ok).sort((a, b) => b.gain - a.gain);
    const best = ranked[0] || null;

    // Upgrade vs Business Reward: implied price of saved points, and break-even probability.
    const biz = out.find((s) => s.key === 'bizReward');
    const upg = out.find((s) => s.key === 'econUpgrade');
    let compare = null;
    if (biz && upg) {
      const savedPts = biz.points - upg.points;
      const extraCash = upg.cash - biz.cash;
      const vFail = E || Eu;
      // gainUpg(P) = P·(VB − vFail) + vFail − Eu − P·U·f ; gainBiz = VB − tP − ptsBiz·f
      const den = (VB - vFail) - upg.points * f;
      const numr = (VB - tP - biz.points * f) - (vFail - Eu);
      compare = {
        savedPts, extraCash,
        impliedCpp: savedPts > 0 ? extraCash / savedPts * 100 : NaN,
        breakevenP: den !== 0 ? numr / den : NaN,
        upgradeBetterAbove: den > 0,
      };
    }
    return { T, S, zone, miles: dist.miles, codes: dist.codes, unknownAirports: dist.unknown,
      nearBoundary: nearZoneBoundary(dist.miles), rewardTable: pts, fareClass: cls,
      strategies: out, ranked, best, compare };
  }

  // ── Calendar (2027) ──
  const VIC_HOLIDAYS = [
    ['VIC summer holidays', '2026-12-19', '2027-01-26'],
    ['VIC autumn holidays', '2027-03-26', '2027-04-11'],
    ['VIC winter holidays', '2027-06-26', '2027-07-11'],
    ['VIC spring holidays', '2027-09-18', '2027-10-03'],
    ['VIC summer holidays', '2027-12-18', '2028-01-27'],
  ];
  const PREFERRED = [
    ['12 Apr – 25 Jun', '2027-04-12', '2027-06-25'],
    ['12 Jul – 17 Sep', '2027-07-12', '2027-09-17'],
    ['4 Oct – 17 Dec', '2027-10-04', '2027-12-17'],
  ];
  const JP_BUSY = [
    ['Golden Week', '2027-04-29', '2027-05-05'],
    ['Obon', '2027-08-13', '2027-08-16'],
    ['Respect-for-Aged / Equinox holidays', '2027-09-18', '2027-09-23'],
    ['Japanese New Year', '2027-12-28', '2028-01-04'],
  ];
  // [label, fromMMDD, toMMDD, tone]
  const JP_SEASONS = [
    ['Cherry blossom (Tokyo/Kyoto, approx.)', '03-24', '04-10', 'good'],
    ['Pleasant spring', '04-11', '05-31', 'good'],
    ['Rainy season — tsuyu (not Hokkaido)', '06-05', '07-20', 'warn'],
    ['Hot & humid summer', '07-15', '09-10', 'warn'],
    ['Peak typhoon season', '08-15', '09-30', 'warn'],
    ['Pleasant autumn', '10-10', '11-14', 'good'],
    ['Autumn leaves (Tokyo/Kyoto, approx.)', '11-15', '12-05', 'good'],
    ['Ski season (Hokkaido/Nagano)', '12-15', '12-31', 'info'],
    ['Ski season (Hokkaido/Nagano)', '01-01', '03-15', 'info'],
  ];
  const BOOKING_WINDOW_DAYS = 353;

  const overlaps = (a1, a2, s, e) => a1 <= e && a2 >= s;
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
  }
  function checkDates(depart, ret) {
    if (!depart) return null;
    const end = ret && ret >= depart ? ret : depart;
    const vic = VIC_HOLIDAYS.filter((h) => overlaps(depart, end, h[1], h[2])).map((h) => h[0]);
    const jp = JP_BUSY.filter((h) => overlaps(depart, end, h[1], h[2])).map((h) => h[0]);
    const inPref = PREFERRED.find((p) => depart >= p[1] && end <= p[2]);
    const seasons = [];
    const y = depart.slice(0, 4), y2 = end.slice(0, 4);
    for (const yr of new Set([y, y2])) for (const s of JP_SEASONS) {
      if (overlaps(depart, end, `${yr}-${s[1]}`, `${yr}-${s[2]}`) && !seasons.some((x) => x[0] === s[0])) seasons.push([s[0], s[3]]);
    }
    const covered = depart >= '2026-12-19' && end <= '2028-01-27';
    return {
      nights: daysBetween(depart, end), vic, jp, preferred: inPref ? inPref[0] : null, seasons, covered,
      outboundOpens: addDays(depart, -BOOKING_WINDOW_DAYS),
      returnOpens: ret ? addDays(ret, -BOOKING_WINDOW_DAYS) : null,
    };
  }

  return {
    ZONE_MAX_MILES, QF_REWARD, PARTNER_REWARD, UPG_TO_BUSINESS, AIRPORTS, BOOKING_WINDOW_DAYS,
    VIC_HOLIDAYS, PREFERRED, JP_BUSY, JP_SEASONS,
    greatCircleMiles, parseRoute, routeMiles, zoneFor, nearZoneBoundary, rewardPts, upgradePts,
    fareClassType, evaluate, checkDates, addDays,
  };
});
