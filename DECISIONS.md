# DECISIONS — assumptions and choices made while building FitOS

Each entry: what was decided, and why. Grouped by area.

## Repository, hosting, CI

1. **Repo is the existing `sabhyasharma89-helios/Fitcoach`, not a new `fitos` repo.** This session can only push to that repo, and it is already public (GitHub Pages is free for public repos). The app is still called FitOS inside.
2. **Pages URL / Vite `base` = `/Fitcoach/`** (matches the repo name exactly): https://sabhyasharma89-helios.github.io/Fitcoach/. The Android build uses a relative base (`./`) instead, selected by `BUILD_TARGET=android`.
3. **Work is on branch `claude/new-session-mjo34s` with a draft PR to `main`.** `deploy.yml` builds and tests every PR, and deploys to Pages only from `main` (after merge). It uses `actions/configure-pages` with `enablement: true`; if GitHub refuses to auto-enable Pages, set *Settings › Pages › Source: GitHub Actions* once.
4. **`deploy.yml` also runs the Playwright smoke test** before deploying, so a broken check-in → workout → log flow can't ship.
5. **APK workflow triggers:** tags `v*` and manual dispatch, as specified, **plus** any push whose commit message contains `[apk]`. The extra trigger exists because this build environment cannot push git tags, and manual dispatch only works once the workflow is on `main`. Tagged builds are normal releases; other builds are marked *pre-release* with tag `build-<run number>`.
6. **Debug APK signed with a fixed, committed debug key** (`android/app/fitos-debug.keystore`, password `android`). A fresh random debug key per CI run would make each new APK refuse to install over the old one, forcing an uninstall that **deletes all on-device data**. The key is a debug key only (not secret, not for the Play Store). `versionCode` = CI run number so each build is an update.
7. **Android SDK:** the workflow uses the SDK preinstalled on GitHub's Ubuntu runners (the `setup-android` action failed on current runners). JDK 21 (Temurin) as specified.
8. **Version bumps from the spec:** Vite 8 (latest; `vite-plugin-pwa` 2.0 supports it), Vitest 5, TypeScript 6, React 19, React Router 7, Tailwind 4, Recharts 3, Dexie 4, Capacitor 8.6, `@capgo/capacitor-health` 8.12.1, Playwright 1.63. No incompatibilities forced any change of library.

## Exercise library

9. **Source:** free-exercise-db (`dist/exercises.json`), 69 entries kept = every exercise in any plan + every swap alternative + warm-up and cool-down moves; 138 images copied to `public/exercises/` and precached for offline use (~8.8 MB). Attribution is on the More › About screen.
10. **Exact ids only.** Several home movements have **no exact entry** in free-exercise-db. Each is mapped to the closest *pictured* movement and the card shows a yellow note explaining the difference; where the database text would be wrong, our own instructions replace it (`instructionsOverride`):
    - Wall push-up → `Incline_Push-Up` pictures (hands on a wall)
    - Knee push-up → `Pushups` pictures (knees down)
    - Chair-assisted squat → `Dumbbell_Squat_To_A_Bench` pictures (no weight, chair). Note: the DB's `Chair_Squat` is actually a barbell machine squat, so it was not used.
    - Slow-tempo squat → `Bodyweight_Squat` pictures with a 4-second tempo
    - Bodyweight split squat → `Split_Squat_with_Dumbbells` pictures (no weight). The DB's `Split_Squats` is a jumping drill and was avoided.
    - Towel row → `Suspended_Row` pictures (towel round a solid pillar/railing/bed post)
    - Reverse snow angel → `Superman` pictures (arms only)
    - Side plank → `Side_Bridge` pictures; that entry has no instructions in the DB, so ours are supplied
    - Stair step-up / stair calf raise → dumbbell versions' pictures without weights
    - Goblet squat → `Goblet_Squat` (pictured with a kettlebell; use a dumbbell)
    - Brisk walk → `Trail_Running_Walking` pictures (walk, don't run)
11. **The build fails** (`npm run build` runs `validate:exercises` first) if any plan key is unknown, any `dbId` is missing, any exercise has fewer than 2 images, an image file is missing, or instructions are empty. Unit tests cover the same.
12. **Animation:** images 0.jpg/1.jpg alternate every 0.8 s; tap pauses/resumes.

## Plan engine

13. **Rotation of 5 strength slots**, each with a gym and a home version, in the order of the default week: (Mon) Push A / Home Upper-push → (Tue) Pull A / Home Lower+Core → (Wed) Legs A + core / Home Full-body circuit → (Fri) Push B / Home Upper-pull → (Sat) Pull B + Legs B / Home Lower+Core. Choosing Home/Travelling takes the home version of the *same* slot, so the sequence is shared.
14. **Day types come from the weekly schedule** (Strength / Cardio / Rest, editable). Cardio days give Zone-2 (gym: incline treadmill, swap → cycle; home: brisk walk). If you check in to train on a scheduled **rest** day, you get the next strength session (you chose to train).
15. **Exercise choices per session** (beginner-friendly, 5–6 exercises, compounds first): see `src/engine/templates.ts`. Pull A uses dumbbell rows/pullover/rear-delt/curls; Pull B uses the lat pulldown (seeded at 39 kg) and cable row; Push B starts with the DB bench (17.5 kg/hand); Legs A includes leg extension (35 kg).
16. **Missed days**: a past scheduled Strength/Cardio day with no logged session and no "Rest day" check-in. Recorded once (with optional reason). **Streak for the 80 % rule** counts consecutive missed training days, skipping rest days. 80 % volume = total working sets × 0.8, removed from the last (accessory) exercises first; no exercise goes below 1 set.
17. **Double progression**: compounds 3 × 8–12, isolation 3 × 10–15. Load rises only when **every planned set reaches the top of the range with an RPE logged at 8 or below** — an unlogged RPE does not count as ≤ 8 (we can't verify it). Increments: +1 kg per dumbbell; +5 kg for machines or lower-body lifts; +2.5 kg for other (cable/barbell) upper-body lifts. Two **consecutive** sessions with any set below the bottom of the range → −10 %. Loads round to 0.5 kg.
18. **Calibration**: any loaded exercise with no history shows "calibrate"; whatever load you log becomes the starting load (no increment that day).
19. **Home ladders** advance after a full 3-set session at the top of the range: reps ladders 3 × 12; holds: plank 3 × 45 s, side plank 3 × 30 s per side. Ladders: push-up (wall → incline → knee → full), squat (chair → bodyweight → 4-s tempo → split squat), bridge (two-leg → single-leg), core (dead bug → plank → side plank).
20. **Deload**: every 6th week counted from the programme start date (editable): same exercises, 2 sets, ~10 % lighter; progression is frozen during deload sessions.
21. **Safety**: no jumping/plyometric exercise exists in any plan or alternative (the 8-week block is also enforced in code for future additions); 5–7 min warm-up and 3–5 min cool-down every session; RPE guidance on every session and set; one-time medical disclaimer.
22. **Feelings**: Tired → accessories lose 1 set, stop at RPE 7. Sore + area → exercises loading that area get 2 sets at −10 %. Pain + area (required) → exercises loading that area are swapped for a same-pattern alternative that doesn't load it, or removed with a note; warm-up/cool-down items loading it are dropped.
23. **Short sessions**: warm-up 5 min (≤ 30 min) / 7 min; cool-down 3 / 5 min. Time estimate ≈ 4 s per rep at mid-range + rest + 30 s transition. If over budget: drop accessories from the end → supersets (pairs) → cap at 2 sets → one circuit → (last resort) drop final exercises with a note. Tests check every slot fits 20/30/45 min and that compound lifts are never dropped in the default plans.

## Tracking

24. **Day boundaries are IST (Asia/Kolkata)** everywhere.
25. **Session status**: *completed* = every planned exercise has all its sets ticked and none skipped; *partial* = at least one set ticked. Partial counts half in the 4-week adherence %. A Health Connect exercise session on a training day counts as done for the calendar/streak (e.g. a walk recorded by Samsung Health on cardio day).
26. **Adherence % (4 weeks)** = done ÷ scheduled training days over the last 28 days (today included only once something is logged). A "Rest day" check-in on a training day lowers adherence but is not logged as "missed".
27. **Weekly volume** = ticked sets per *primary* muscle (from free-exercise-db), grouped into Chest, Back, Shoulders, Arms, Legs, Core.
28. **Steps target** = last Mon–Sun average + 1,000, capped at 10,000, fixed from Monday to Sunday. With no step history it starts at **5,000**. Days with no data are excluded from the average.
29. **Weight**: 7-day moving average = mean of readings in the trailing 7 calendar days. Weekly rate = trend today − trend 7 days ago. Projection only when the trend is falling. Rapid-loss warning when the trend fell > 1 % per week in each of the last two weeks.
30. **Waist** flag line at **90 cm** — Indian consensus guideline for abdominal obesity in men (Misra et al., JAPI 2009).
31. **Calorie target** = Mifflin-St Jeor BMR × activity factor − 500, floor 1,500 kcal. Default activity "lightly active" (×1.375). It is recalculated when the 7-day weight trend moves ≥ 2 kg from the weight the target was based on. Seed: 2,200 kcal (BMR 1,963.75 × 1.375 − 500). Protein = 1.6 g × goal weight (85 kg → 136 g). Fibre 30 g. Seed birth year 1989 (age 37 in 2026).
32. **Manual entries win over imports**: a weight or step count you type for a day is never overwritten by Health Connect or a CSV.

## Food data

33. **No nutrition value was invented.** Every bundled item comes from one of:
    - **INDB** (Indian Nutrient Databank, Jaacks et al.; recipes computed from ICMR-NIN IFCT 2017/2004) — cooked Indian dishes, per 100 g and per INDB serving;
    - **IFCT 2017** (ICMR-NIN) via the `@ifct2017/compositions` data package — raw staples (energy converted kJ ÷ 4.184; oils/ghee have no energy value in that package, so energy = IFCT fat × 9 kcal/g, stated in the item's source);
    - **UK CoFID 2021** and **USDA FoodData Central**, as bundled with INDB — oats, curd/yogurt, bread, butter, honey, sugar, peanut butter, tofu, buttermilk, makhana, etc.
    USDA/IFCT websites themselves were not reachable from the build environment; the values were taken from these published data packages, and each item's `source` names the dataset and its food code.
34. **Quality gates** in `scripts/foods/build_foods.py` drop an item rather than "fix" it: energy must agree with macros (Atwater, with or without fibre energy, ±12 % + 10 kcal). Dropped for failing: 4 INDB soups, INDB chicken pulao, a USDA "roasted chickpeas" entry. **Deep-fried snacks (samosa, pakora, poori, etc.) were deliberately left out**: INDB counts all frying oil as eaten, giving values 2–3× typical. Log them via barcode or as a custom food.
35. **Serving sizes**: INDB servings are used where the weight is plausible for the unit; implausible ones (e.g. "1 rasgulla = 342 g", "1 kulfi = 270 g") are dropped — those foods are logged in grams. Serving sizes for raw staples (e.g. 1 egg = 50 g edible, 1 tsp oil = 5 g) are FitOS conventions; the nutrient values are per 100 g from the source. You can always log grams.
36. **Result: 260 items** (more than the ~150 asked for, to cover staples and dishes properly).
37. **Open Food Facts**: only the barcode number is sent. A product is accepted only if the label has per-100 g energy, protein, carbs and fat; otherwise you are sent to the custom-food form. Scanned products are cached on the device.
38. **Barcode scanning** uses the browser's `BarcodeDetector` when present (Chrome on Android) and ZXing otherwise; typing the number always works.

## Android / Health Connect

39. **Plugin API verified against `@capgo/capacitor-health` 8.12.1 source**: `isAvailable`, `requestAuthorization`, `queryAggregated` (steps and active calories, daily buckets, sum), `readSamples` (weight), `queryWorkouts` (exercise; duration in seconds), `openHealthConnectSettings`. Data types requested: `steps`, `weight`, `workouts` (→ READ_EXERCISE), `calories` (→ READ_ACTIVE_CALORIES_BURNED).
40. **Permissions**: the plugin's library manifest declares ~45 health permissions; the app manifest removes all of them except READ_STEPS, READ_WEIGHT, READ_EXERCISE, READ_ACTIVE_CALORIES_BURNED. **Heart rate is not requested** (optional in the spec, and nothing in FitOS uses it). CAMERA (barcodes) and VIBRATE (rest timer) are also declared.
41. **Rationale / privacy screen**: the plugin's `PermissionsRationaleActivity` (with the Android 13 intent filter and the Android 14+ `VIEW_PERMISSION_USAGE` alias) is merged into the app; it shows `privacy.html` bundled in the APK. The same page is published on the website.
42. **Sync** runs on app open, when the app returns to the foreground, by pull-to-refresh, and from the Steps tab / Settings: today + the last 30 days (Health Connect's default read window).
43. **minSdk 26**, compile/target SDK 36, app id `app.fitos.personal`.

## Data safety & privacy

44. All data stays in IndexedDB on the device; nothing personal is in the repo. JSON backup/restore in More; restore is atomic (a bad file changes nothing); reminder after 14 days. Dexie schema is versioned (`version(1)`); future changes must add `version(n).upgrade()` — existing versions are never edited.
45. The workout in progress is kept in `localStorage` so an accidental close doesn't lose it.

## UI

46. Dark theme by default, with a Light option in More › Appearance (a per-device preference). Bottom nav: Today · Plan · Log · Progress · More. Exercise library reachable from Plan and More. Layout targets 412 × 891 CSS px (S25 Ultra), touch targets ≥ 44 px, set-done buttons 48 px.
47. Weight/waist shown to 1 decimal, kcal/steps/grams as whole numbers with Indian digit grouping (e.g. 10,000 / 1,00,000).

## Verification done

48. 75 unit tests (engine, metrics, food data, CSV import, database, exercise validation) and a Playwright smoke test (check-in → workout → food → weight → calendar → progress) at 412 × 891.
49. Lighthouse 12 on the production build: Performance 94, Accessibility 100, Best Practices 100. (Lighthouse 12 removed the PWA category; installability was checked directly: valid manifest with 192/512/maskable icons, service worker active, app and exercise images load with the network off.)
50. Samsung menu paths in the README were checked against Samsung/Google support material as of November 2026. Samsung renames menus between One UI versions, so the README also gives the "search Settings" fallback.
51. **Not verifiable here:** installing the APK on a real phone and seeing Samsung Health steps arrive. The APK is built by CI; that last step needs your phone.
