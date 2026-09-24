# RITE

Ranked honesty fitness. Heat rises and falls. No paywall.

A free, offline-first calorie/training tracker PWA. No account, no cloud, no
subscription — your data lives on your device, and you can export it as a JSON
file any time. A coach named Ash roasts, hypes, and refuses to flatter you.

## The system

- **Heat (0–100)** — the daily weather. Rises when you hit calories, protein,
  and training; decays −9/day (−5 once below 30) for every day you skip.
  Settling an empty day with training earns +8 (fasted work counts); ghosting
  a full day costs −12.
- **XP / Ranks** — the climb. XP never decays: Cinder → Spark → Kindling →
  Flame → Blaze → Inferno → Solar → Eternal.
- **The verdict** — "Close today" banks the swing shown live in the Arena.
  Preview and settle share one scoring function (`scoreDay` in
  `src/engine.js`), so the swing you see is always the swing you get.
  Mis-settled? **Reopen today** rewinds heat, XP, and streak exactly.
- **Confession** — admitting a slip on a bad-calorie day softens the blow (+3).
- **Tracking day** — ends at 3am. A 1am snack lands on yesterday.

## Features

- Offline pantry of ~216 foods; remote lookups hit Open Food Facts
  (search-a-licious) first, then USDA FoodData Central if you add your own
  free API key in Self (stored on-device only).
- Barcode scanning via `BarcodeDetector` where supported (Android Chrome),
  manual barcode entry everywhere, lookups via OFF v2 product API.
- Meal plan mode (planned food doesn't move Heat until you "Eat" it),
  repeat-yesterday per slot, inline amount editing on logged items,
  composite saved meals.
- Trends: 30-day heat bars, weigh-in line + 5-point moving average, weekly
  macro averages. Weigh-ins are deletable.
- Six themes: **Ember** (warm dark, default), **Vesper** (dusk violet), **HUD** (cyan cyberpunk console), **Nebula** (electric violet dark), **Aura** (soft violet light), and **Sketch** (ink-on-paper: marker numerals, typewriter coach, watercolor ink orb, hand-drawn orbit decor). Light themes composite the canvas without additive glow so colors stay true. — the flagship
  cyberpunk console skin built from `design/reference/rite-hud.jpg`: plasma-orb
  heat visual, framed console panels, floating icon dock, gauge tick hardware,
  a heat-reactive accent ramp (cyan → white-hot → red-alert via
  `data-heat-band`), a scanline sweep, and a full-screen verdict stamp when the
  day closes. HUD art lives in `src/hud/*.webp` (~90KB total) — the originals
  in `public/vesper/` are ~7MB matte-baked sources, do not ship them.
- Installable PWA; new builds announce themselves with a reload toast.

## Data

Everything is `localStorage` (`ember.v1` + a shadow copy `ember.v1.bak`) with
`navigator.storage.persist()` requested on start. Self → Download backup
produces a JSON file; restore replaces everything after a confirm. The app
nags in the Arena when no backup exists or the last one is 14+ days old.

## Develop

```sh
npm install
npm run dev        # http://localhost:5174 (strict port)
npm test           # vitest — engine scoring, store, food parsing
npm run build      # production build in dist/
npm run preview    # serve the build
```

## Architecture

Zero framework. `src/app.js` renders templates with `el()` and escapes every
interpolated value. Pure logic lives in testable modules: `engine.js`
(scoring/ranks/decay), `store.js` (persistence/dates/plans/meals), `foods.js`
(search/scale), `coach.js` + `ash-lines.js` (the voice), `barcode.js`
(scan + OFF lookup), `flame.js` (canvas flame, honors reduced motion),
`themes.js`, `pwa.js` (install + update toast).
