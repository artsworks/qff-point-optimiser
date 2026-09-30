# QFF points optimiser

A static page, hosted on GitHub Pages, that compares ways to spend Qantas Frequent Flyer points on a trip. It was built for a Melbourne to Japan trip for two people with 400,000 points. It uses the Classic Reward tables for bookings made from 5 August 2025, zones 1 to 10. Direct Melbourne to Japan flights are Zone 6 (4,801 to 5,800 miles).

Live site: https://artsworks.github.io/qff-points-optimizer/

## What it does

You add one journey for each itinerary you find. A journey has dates, a route, cash fares for the same flights, and seat availability from the [Qantas Flight Reward finder](https://flightrewardfinder.qantas.com/). For each journey the page:

- Estimates the miles from the route (for example `MEL-NRT`, `MEL-SYD-HND` or `MEL-NRT-FUK`) and picks the zone. It warns when a route is close to a zone limit, and you can set the zone yourself.
- Uses the Qantas table, or the more expensive partner table for airlines such as Japan Airlines.
- Compares Economy, Premium Economy and Business Classic Rewards, Business one way with Economy the other, paid Economy or Premium Economy with a points upgrade, and cash fares.
- Names the best option and the next best. For the upgrade route it shows what you pay in cash for each point you save, and the upgrade chance at which it beats a Business reward.
- Checks the Economy fare class. Classes G, K, L, M, S, V, B, H and Y can be upgraded, and other classes can't. It also marks options that need more points than you have.
- Checks the dates against 2027 Victorian school holidays and busy periods in Japan, and shows when reward seats open, about 353 days before departure.

A ranking table sorts the journeys by gain. Gain is the value of the trip, minus the cash you pay, minus the points you use at your value per point. You can set the balance, travellers, status, the value of a point you keep, and how much Business is worth to you. The page saves your data in `localStorage`, and you can share it as a link or export it as CSV.

The calculations are in `calc.js`, which has no DOM code. Run the tests with:

```sh
node --test test/calc.test.js
```

## Key numbers (Zone 6, per person)

| Cabin | Return, per person | Return, 2 people |
|---|---:|---:|
| Economy | 72,400 | 144,800 |
| Premium Economy | 147,600 | 295,200 |
| Business | 196,800 | 393,600 |
| First | 295,400 | 590,800 |

An upgrade from paid Economy to Business costs 78,500 points per person per flight, or 43,100 on a flexible fare. For 2 people on a return trip that is 314,000 points, which is 79,600 fewer than a Business reward. The upgrade may not clear.

## Run locally

There is no build step. Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
```

## GitHub Pages

The site is served from the root of `main`. The `.nojekyll` file turns off Jekyll. In the repo, open Settings, then Pages, and set the source to `main` and `/ (root)`.

## Sources

- [Classic Flight Reward tables](https://www.qantas.com/en-au/frequent-flyer/use-points/classic-flight-rewards/tables)
- [Classic Upgrade Reward tables](https://www.qantas.com/en-au/frequent-flyer/use-points/classic-upgrade-rewards/tables)
- [Upgrade eligibility](https://www.qantas.com/en-au/manage-booking/upgrade)
- [Victorian school term dates](https://www.vic.gov.au/school-term-dates-and-holidays-victoria)

Not affiliated with Qantas. Your data stays in your browser.
