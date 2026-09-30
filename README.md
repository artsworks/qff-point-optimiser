# QFF Points Optimiser

A zero-dependency static tool (GitHub Pages) for working out the best value per
Qantas Frequent Flyer point for a Melbourne → Japan trip — built around a
400,000-point balance and the post-5 Aug 2025 Classic Reward table
(zones 1–10; MEL → Japan is Zone 6, 4,801–5,800 miles).

**Live site:** https://artsworks.github.io/qff-points-optimizer/

## What it does

Add one **journey** per real itinerary you find (dates + route + same-flight
cash fares + reward-seat availability from the
[Qantas Flight Reward finder](https://flightrewardfinder.qantas.com/)). For each
journey it:

- **Works out the zone from the route** (`MEL-NRT`, `MEL-SYD-HND`,
  `MEL-NRT-FUK`…) via great-circle miles, uses the Qantas or partner table for
  zones 1–10, flags routes near a zone edge, and lets you override the zone.
- **Compares every option**: Economy / PE / Business Classic Rewards, Business
  one way + Economy the other, paid Economy or PE + Classic Upgrade, and cash.
- **Gives a plain-English verdict**: best option, runner-up, and for the
  upgrade route the price you're effectively paying per point saved and the
  break-even upgrade odds.
- **Checks fare class** (G K L M S V / B H Y upgradeable; others not) and seat
  availability, and marks options that exceed your balance.
- **Checks dates** against 2027 VIC school holidays, Japanese busy periods and
  seasons, and shows when rewards open (~353 days out).

A **ranking table** sorts all journeys by *Gain* (trip value − cash − points ×
your ¢/pt). Tailor with balance, travellers, status, what a point is worth to
you, and how much Business is worth to you. Share link (state in URL), CSV
export, `localStorage` persistence.

All maths is in `calc.js` (pure, UMD) and tested:

```sh
node --test test/calc.test.js
```

## Key numbers (Zone 6, per person, return)

| Cabin | Pts pp | 2 pax return |
|---|---:|---:|
| Economy | 72,400 | 144,800 |
| Premium Economy | 147,600 | 295,200 |
| Business | 196,800 | **393,600** |
| First | 295,400 | 590,800 |

Economy→Business upgrade: **78,500** pp/sector paid · 43,100 flexible ·
83,600 from an Economy Reward seat → **314,000 pts** for 2 pax return.
Saving vs Business Reward: **79,600 pts**, at the cost of upgrade uncertainty.

## Run locally

No build step — open `index.html`, or serve it:

```sh
python3 -m http.server 8000
```

## Deploy / GitHub Pages

The site is served from the repo root of `main` with `.nojekyll`:

- Repo → **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**

## Sources

- [Classic Flight Reward tables](https://www.qantas.com/en-au/frequent-flyer/use-points/classic-flight-rewards/tables)
- [Classic Upgrade Reward tables](https://www.qantas.com/en-au/frequent-flyer/use-points/classic-upgrade-rewards/tables)
- [Upgrade eligibility](https://www.qantas.com/en-au/manage-booking/upgrade)
- [VIC school term dates](https://www.vic.gov.au/school-term-dates-and-holidays-victoria)

Not affiliated with Qantas. All data stays in your browser.
