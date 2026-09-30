# QFF Points Optimiser

A zero-dependency static tool (GitHub Pages) for working out the best value per
Qantas Frequent Flyer point for a Melbourne → Japan trip — built around a
400,000-point balance and the post-5 Aug 2025 Classic Reward table
(Zone 6: 4,801–5,800 miles).

**Live site:** https://artsworks.github.io/qff-points-optimizer/

## What it does

- **Strategy comparison** — Economy / Premium Economy / Business / First Classic
  Rewards vs *paid Economy + Classic Upgrade*, side by side: points, cash,
  leftover balance, net value, cents-per-point, and a combined "score" that
  prices leftover points at an assumed ¢/pt.
- **Upgrade expected value** — model the upgrade probability `P` explicitly
  (Qantas publishes no clear-rate): expected net value, ¢/pt if it clears,
  chance of flying Economy anyway, and the breakeven `P*` at which the upgrade
  path beats a confirmed Business Reward. Points are treated as spent only if
  the upgrade confirms, matching Qantas' rules.
- **Fare-class guard** — warns when a fare class can't be upgraded
  (international sale classes E/N/O/Q are excluded).
- **Date checker** — flags trips overlapping Victorian school holidays or
  Japanese busy periods (Golden Week, Obon, Silver Week, New Year) and
  highlights the preferred 2027 windows.
- **Candidate flights table** — one row per real itinerary found on the Qantas
  site; computes reward/upgrade points and CPP per row; CSV export; everything
  persists in `localStorage`.
- **Decision guide** — applies the A–E rule hierarchy from the trip brief to
  whatever availability you enter.

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
