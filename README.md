# FitOS

A personal weight-management app: gym and home workouts, food, body weight, waist, steps and adherence — built for one person, with all data kept on the phone.

- **Live app (PWA):** https://sabhyasharma89-helios.github.io/Fitcoach/
- **Android app (APK, reads Samsung Health steps via Health Connect):** [Releases](https://github.com/sabhyasharma89-helios/Fitcoach/releases)
- Assumptions and design decisions: [DECISIONS.md](DECISIONS.md)

> FitOS is general fitness guidance, not medical advice. Please see your doctor before starting a new exercise or diet programme.

---

## 1. Install the web app (any phone)

1. Open **https://sabhyasharma89-helios.github.io/Fitcoach/** in **Chrome** on your phone.
2. Tap **⋮ › Add to home screen › Install** (in Samsung Internet: **☰ › Add page to › Home screen**).
3. Open FitOS from the home screen. It works offline, including all exercise pictures.

The web version cannot read Health Connect (no website can). Use it with typed-in steps or the Samsung Health CSV import (Log › Steps), or install the Android app below for automatic steps.

## 2. Install the Android app (Samsung Galaxy S25 Ultra)

The APK is built automatically by GitHub and attached to a release.

1. On the phone, open the [Releases page](https://github.com/sabhyasharma89-helios/Fitcoach/releases) and download the latest `FitOS-<version>.apk`.
2. **Switch off Samsung Auto Blocker just for the install.** Auto Blocker blocks apps from outside Galaxy Store/Play Store.
   *Settings › Security and privacy › Auto Blocker* → turn it **Off**.
3. Open the downloaded APK (from the Chrome download notification, or *My Files › Downloads*). When Android asks, allow **Install unknown apps** for that app (Chrome or My Files), then tap **Install**.
4. **Turn Auto Blocker back On** (*Settings › Security and privacy › Auto Blocker*). The installed app keeps working.

Updating: install a newer APK the same way. Every FitOS APK is signed with the same key, so it installs **over** the old one and **keeps your data**. (Uninstalling deletes the app's data — export a backup first: More › Backup.)

## 3. One-time Samsung Health → Health Connect setup

Health Connect is built into Android 14 and later (your S25 Ultra runs Android 15+), so there is nothing to install from the Play Store.

**In Samsung Health**

1. Samsung Health › **⋮ › Settings › Health Connect** → allow Samsung Health to **write Steps, Weight and Exercise** to Health Connect.
2. Samsung Health › **⋮ › Settings › Sync with Samsung account** → **On** (Samsung Health only shares data with Health Connect when this is on; tap *Sync now* if steps don't appear).

**In FitOS (Android app)**

3. More › **Samsung Health · Health Connect › Connect Health Connect** → Health Connect opens → allow **Steps, Weight, Exercise, Active calories burned** for FitOS.
4. To check or change this later: *Settings › Security and privacy › More privacy settings › Health Connect › App permissions › FitOS*. (Samsung renames menus between One UI versions — if you can't find it, type **Health Connect** in the Settings search bar.)

FitOS syncs today plus the last 30 days when it opens, when you return to it, and when you **pull down** on any screen. Steps appear on Today within one refresh. Weights you type yourself are never overwritten by Health Connect.

## 4. Using FitOS

- **Today** — the daily check-in: where you're training (Gym / Home / Travelling / Rest day), time available (20 / 30 / 45 / 60+ min) and how you feel (Fresh / Normal / Tired / Sore / Pain + body part). FitOS builds the exact session: order, sets × reps × load, rest, warm-up and cool-down. Skip the check-in and it uses your weekly schedule. The dashboard shows today's session, steps ring, calories and protein left, weight trend, streak and next session.
- **Workout** — tick each set (load, reps, RPE); the rest timer starts by itself and buzzes when it ends. Swap or skip (with a reason) any exercise; tap *How to* for pictures and steps. Load goes up when every set hits the top of the rep range at RPE 8 or less.
- **Plan** — month calendar (green done, blue partial, red missed, grey rest, outlined planned). Tap a day for what was planned vs done, or the exact plan for future days.
- **Log** — food (search 260 Indian foods and staples, scan barcodes, custom foods, saved meals, copy yesterday, water), weight and waist, steps.
- **Progress** — weight with 7-day trend, weekly rate and projected goal date; waist with the 90 cm risk line; steps; streak, 4-week adherence, missed days with reasons, weekly sets per muscle group.
- **More** — profile, activity level and targets, weekly schedule, Health Connect, light/dark theme, backup/restore, About.

**Back up every couple of weeks** (More › Backup › Export) — the data lives only on your phone. FitOS reminds you after 14 days.

### Default weekly template

| Day | Gym | Home (no equipment) |
|---|---|---|
| Mon | Push A (machines) | Home Upper (push focus) |
| Tue | Pull A (free weights) | Home Lower + Core |
| Wed | Legs A (machines) + core | Home Full-body circuit |
| Thu | Zone-2 cardio 35–45 min + mobility | Brisk walk 40 min + mobility |
| Fri | Push B (free weights) | Home Upper (pull/back focus) |
| Sat | Pull B (machines) + Legs B (free weights) | Home Lower + Core |
| Sun | Rest / easy walk | Rest / easy walk |

Strength sessions run as a **sequence**: a missed day never stacks up — you simply do the next one. Three or more missed days in a row → the next session is at 80 % volume. Every 6th week is a deload.

## 5. Data sources and credits

- Exercise pictures and instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense).
- Foods: Indian Nutrient Databank (INDB, Jaacks et al.) built on ICMR-NIN **IFCT 2017**; IFCT 2017 raw foods; UK CoFID 2021; USDA FoodData Central. Every item shows its source. Packaged foods: [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
- Calorie target: Mifflin-St Jeor. Waist threshold 90 cm for Indian men: Misra et al., JAPI 2009.

Privacy policy: [privacy.html](https://sabhyasharma89-helios.github.io/Fitcoach/privacy.html) — no accounts, no servers, no analytics.

---

## Development

```bash
npm ci
npm run dev                # local dev server
npm test                   # unit tests (Vitest)
npm run lint
npm run build              # validates every exercise id, type-checks, builds the PWA
npm run test:e2e           # Playwright smoke test at 412 × 891 (Galaxy S25 Ultra)
npm run sync:exercises     # re-download the exercise subset + images
npm run cap:sync           # Android: build web assets and copy into android/
```

Rebuild the foods dataset (needs Python 3 + openpyxl, the INDB repo and the `@ifct2017/compositions` package):

```bash
python3 -I scripts/foods/build_foods.py <INDB repo dir> <ifct compositions index.csv> src/data/foods.json
```

### CI

- `.github/workflows/deploy.yml` — on every PR and push to `main`: lint, unit tests, build, Playwright smoke test; on `main` it deploys to GitHub Pages with `actions/deploy-pages`. (If the first deploy says Pages isn't enabled: *Settings › Pages › Source: GitHub Actions*.)
- `.github/workflows/android.yml` — on a `v*` tag, a manual run, or a commit message containing `[apk]`: builds the debug APK (JDK 21, Gradle) and attaches it to a GitHub Release.

Layout: `src/engine/` (pure, unit-tested plan logic), `src/data/` (exercise catalog, foods), `src/db/` (Dexie schema, backup), `src/pages/`, `src/health/` (Health Connect), `android/` (Capacitor project).
