/**
 * FitOS exercise catalog.
 *
 * Every entry maps to an EXACT free-exercise-db id (`dbId`) — that is where the pictures,
 * numbered instructions and muscle lists come from. A few home movements have no exact
 * twin in the database (e.g. wall push-up, towel row); those use the closest pictured
 * movement and carry a `variationNote` (shown on the card) and, where the database text
 * would be misleading, an `instructionsOverride`.
 *
 * `scripts/validate-exercises.ts` (run before every build) fails if any `dbId` is missing
 * from the synced database or has no images/instructions.
 */

export type Location = 'gym' | 'home';
export type Equipment = 'machine' | 'cable' | 'dumbbell' | 'barbell' | 'bodyweight' | 'cardio-machine';
export type Kind = 'compound' | 'isolation' | 'cardio' | 'mobility';
export type Region = 'upper' | 'lower' | 'core' | 'full';
export type Unit = 'reps' | 'seconds' | 'minutes';

export const BODY_PARTS = [
  'neck',
  'shoulder',
  'elbow',
  'wrist',
  'chest',
  'upper-back',
  'lower-back',
  'core',
  'hip',
  'knee',
  'ankle',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  neck: 'Neck',
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  chest: 'Chest',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  core: 'Abs / core',
  hip: 'Hip / glutes',
  knee: 'Knee',
  ankle: 'Ankle / calf',
};

export type Pattern =
  | 'horizontal-push'
  | 'incline-push'
  | 'vertical-push'
  | 'chest-fly'
  | 'lateral-raise'
  | 'triceps'
  | 'horizontal-pull'
  | 'vertical-pull'
  | 'rear-delt'
  | 'biceps'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'knee-extension'
  | 'knee-flexion'
  | 'calf'
  | 'glute-bridge'
  | 'back-extension'
  | 'core-stability'
  | 'core-flexion'
  | 'cardio'
  | 'warmup'
  | 'cooldown';

export interface CatalogExercise {
  key: string;
  dbId: string;
  name: string;
  variationNote?: string;
  instructionsOverride?: string[];
  pattern: Pattern;
  locations: Location[];
  equipment: Equipment;
  kind: Kind;
  region: Region;
  /** Areas this exercise loads — used by the Pain/Sore filters. */
  loads: BodyPart[];
  unit: Unit;
  tempo: string;
  cues: string[];
  /** Jumping / plyometric. Blocked for the first 8 weeks. None are in the default plans. */
  highImpact?: boolean;
  /** Dumbbell loads are per hand. */
  perHand?: boolean;
}

const E = (e: CatalogExercise) => e;

export const CATALOG: CatalogExercise[] = [
  // ───────────── GYM · PUSH ─────────────
  E({
    key: 'machine-chest-press', dbId: 'Leverage_Chest_Press', name: 'Machine chest press',
    pattern: 'horizontal-push', locations: ['gym'], equipment: 'machine', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Handles at mid-chest height', 'Shoulder blades pinned back on the pad', 'Stop just short of locking the elbows'],
  }),
  E({
    key: 'machine-incline-press', dbId: 'Leverage_Incline_Chest_Press', name: 'Machine incline chest press',
    pattern: 'incline-push', locations: ['gym'], equipment: 'machine', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Seat set so handles start at upper chest', 'Keep wrists stacked over elbows', 'Exhale as you press'],
  }),
  E({
    key: 'machine-shoulder-press', dbId: 'Machine_Shoulder_Military_Press', name: 'Machine shoulder press',
    pattern: 'vertical-push', locations: ['gym'], equipment: 'machine', kind: 'compound', region: 'upper',
    loads: ['shoulder', 'elbow', 'wrist', 'neck'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Back flat against the pad', 'Ribs down — do not arch', 'Press in line with your ears'],
  }),
  E({
    key: 'pec-deck', dbId: 'Butterfly', name: 'Pec deck (machine fly)',
    pattern: 'chest-fly', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'upper',
    loads: ['chest', 'shoulder'], unit: 'reps', tempo: '2 s open, 1 s squeeze',
    cues: ['Slight bend in the elbows throughout', 'Do not let hands drift behind your body', 'Squeeze 1 s in the middle'],
  }),
  E({
    key: 'cable-lateral-raise', dbId: 'Cable_Seated_Lateral_Raise', name: 'Cable lateral raise',
    pattern: 'lateral-raise', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'upper',
    loads: ['shoulder'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Lead with the elbow, not the hand', 'Stop at shoulder height', 'No body swing'],
  }),
  E({
    key: 'triceps-pushdown', dbId: 'Triceps_Pushdown_-_Rope_Attachment', name: 'Rope triceps pushdown',
    pattern: 'triceps', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'wrist'], unit: 'reps', tempo: '2 s up, 1 s down',
    cues: ['Elbows pinned to your sides', 'Spread the rope at the bottom', 'Control the way up'],
  }),
  E({
    key: 'machine-triceps-extension', dbId: 'Machine_Triceps_Extension', name: 'Machine triceps extension',
    pattern: 'triceps', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'upper',
    loads: ['elbow'], unit: 'reps', tempo: '2 s back, 1 s press',
    cues: ['Elbows in line with the machine pivot', 'Full extension without slamming', 'Keep shoulders down'],
  }),
  E({
    key: 'db-bench-press', dbId: 'Dumbbell_Bench_Press', name: 'Dumbbell bench press', perHand: true,
    pattern: 'horizontal-push', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Feet flat, slight arch, shoulder blades squeezed', 'Elbows about 45° from your body', 'Lower to chest level, press up and slightly in'],
  }),
  E({
    key: 'db-incline-press', dbId: 'Incline_Dumbbell_Press', name: 'Incline dumbbell press', perHand: true,
    pattern: 'incline-push', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Bench at 30°, not steeper', 'Wrists straight over elbows', 'Touch dumbbells lightly at the top'],
  }),
  E({
    key: 'db-shoulder-press', dbId: 'Dumbbell_Shoulder_Press', name: 'Seated dumbbell shoulder press', perHand: true,
    pattern: 'vertical-push', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'upper',
    loads: ['shoulder', 'elbow', 'wrist', 'neck'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Use a bench with back support', 'Start at ear height', 'Do not flare the ribs'],
  }),
  E({
    key: 'db-lateral-raise', dbId: 'Side_Lateral_Raise', name: 'Dumbbell lateral raise', perHand: true,
    pattern: 'lateral-raise', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['shoulder'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Slight forward lean', 'Raise to shoulder height only', 'Light weight, strict form'],
  }),
  E({
    key: 'db-overhead-triceps', dbId: 'Standing_Dumbbell_Triceps_Extension', name: 'Overhead dumbbell triceps extension',
    pattern: 'triceps', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'shoulder'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['One dumbbell held with both hands', 'Elbows point forward, not out', 'Sit on a bench if your lower back arches'],
  }),
  E({
    key: 'db-flyes', dbId: 'Dumbbell_Flyes', name: 'Dumbbell fly', perHand: true,
    pattern: 'chest-fly', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['chest', 'shoulder'], unit: 'reps', tempo: '2 s open, 1 s close',
    cues: ['Soft elbows, like hugging a barrel', 'Lower until you feel a chest stretch, not further', 'Keep weights light'],
  }),

  // ───────────── GYM · PULL ─────────────
  E({
    key: 'lat-pulldown', dbId: 'Wide-Grip_Lat_Pulldown', name: 'Lat pulldown',
    pattern: 'vertical-pull', locations: ['gym'], equipment: 'cable', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'shoulder', 'elbow'], unit: 'reps', tempo: '1 s down, 2 s up',
    cues: ['Pull the bar to the top of your chest', 'Lead with elbows, chest up', 'No leaning back past ~15°'],
  }),
  E({
    key: 'close-grip-pulldown', dbId: 'Close-Grip_Front_Lat_Pulldown', name: 'Close-grip lat pulldown',
    pattern: 'vertical-pull', locations: ['gym'], equipment: 'cable', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'shoulder', 'elbow'], unit: 'reps', tempo: '1 s down, 2 s up',
    cues: ['Shoulders down before you pull', 'Elbows to the ribs', 'Control the return'],
  }),
  E({
    key: 'seated-cable-row', dbId: 'Seated_Cable_Rows', name: 'Seated cable row',
    pattern: 'horizontal-pull', locations: ['gym'], equipment: 'cable', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'lower-back', 'elbow'], unit: 'reps', tempo: '1 s pull, 2 s return',
    cues: ['Sit tall, slight knee bend', 'Pull to the belly button', 'Do not rock your torso'],
  }),
  E({
    key: 'machine-row', dbId: 'Leverage_Iso_Row', name: 'Machine row (chest-supported)',
    pattern: 'horizontal-pull', locations: ['gym'], equipment: 'machine', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'elbow'], unit: 'reps', tempo: '1 s pull, 2 s return',
    cues: ['Chest stays on the pad', 'Squeeze shoulder blades together', 'Full stretch at the front'],
  }),
  E({
    key: 'face-pull', dbId: 'Face_Pull', name: 'Cable face pull',
    pattern: 'rear-delt', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'upper',
    loads: ['shoulder', 'upper-back'], unit: 'reps', tempo: '1 s pull, 2 s return',
    cues: ['Rope at forehead height', 'Pull towards your eyes, elbows high', 'Thumbs point back at the end'],
  }),
  E({
    key: 'reverse-pec-deck', dbId: 'Reverse_Machine_Flyes', name: 'Reverse pec deck',
    pattern: 'rear-delt', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'upper',
    loads: ['shoulder', 'upper-back'], unit: 'reps', tempo: '1 s out, 2 s back',
    cues: ['Chest on the pad', 'Arms slightly bent', 'Move from the shoulders, not the hands'],
  }),
  E({
    key: 'machine-biceps-curl', dbId: 'Machine_Bicep_Curl', name: 'Machine biceps curl',
    pattern: 'biceps', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'wrist'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Armpits snug on the pad', 'Full stretch at the bottom', 'No swinging'],
  }),
  E({
    key: 'cable-curl', dbId: 'Standing_Biceps_Cable_Curl', name: 'Cable biceps curl',
    pattern: 'biceps', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'wrist'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Elbows fixed at your sides', 'Squeeze at the top', 'Lower slowly'],
  }),
  E({
    key: 'one-arm-db-row', dbId: 'One-Arm_Dumbbell_Row', name: 'One-arm dumbbell row', perHand: true,
    pattern: 'horizontal-pull', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'elbow', 'lower-back'], unit: 'reps', tempo: '1 s pull, 2 s down',
    cues: ['Hand and knee on the bench, flat back', 'Pull the dumbbell to your hip', 'Do not twist the torso'],
  }),
  E({
    key: 'db-incline-row', dbId: 'Dumbbell_Incline_Row', name: 'Chest-supported dumbbell row', perHand: true,
    pattern: 'horizontal-pull', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'elbow'], unit: 'reps', tempo: '1 s pull, 2 s down',
    cues: ['Lie face down on a 30–45° bench', 'Squeeze shoulder blades at the top', 'Keeps your lower back out of it'],
  }),
  E({
    key: 'db-pullover', dbId: 'Bent-Arm_Dumbbell_Pullover', name: 'Dumbbell pullover',
    pattern: 'vertical-pull', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['upper-back', 'shoulder', 'chest'], unit: 'reps', tempo: '2 s back, 1 s over',
    cues: ['Hips low, core braced', 'Lower only as far as shoulders allow', 'Keep the elbow angle fixed'],
  }),
  E({
    key: 'db-rear-delt-raise', dbId: 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench', name: 'Rear-delt raise (head on bench)', perHand: true,
    pattern: 'rear-delt', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['shoulder', 'upper-back'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Forehead on an incline bench for support', 'Lift out to the sides', 'Very light weight'],
  }),
  E({
    key: 'db-curl', dbId: 'Dumbbell_Bicep_Curl', name: 'Dumbbell biceps curl', perHand: true,
    pattern: 'biceps', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'wrist'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Elbows stay by your sides', 'Turn palms up as you lift', 'No hip swing'],
  }),
  E({
    key: 'hammer-curl', dbId: 'Hammer_Curls', name: 'Hammer curl', perHand: true,
    pattern: 'biceps', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'wrist'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Palms face each other the whole time', 'Upper arm still', 'Easier on the wrists than normal curls'],
  }),

  // ───────────── GYM · LEGS ─────────────
  E({
    key: 'leg-press', dbId: 'Leg_Press', name: 'Leg press',
    pattern: 'squat', locations: ['gym'], equipment: 'machine', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'lower-back'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Feet shoulder-width, mid-platform', 'Lower until knees near 90°, hips stay on the seat', 'Do not lock knees at the top'],
  }),
  E({
    key: 'leg-extension', dbId: 'Leg_Extensions', name: 'Leg extension',
    pattern: 'knee-extension', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'lower',
    loads: ['knee'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Knee lined up with the machine pivot', 'Pause 1 s at the top', 'Lower under control'],
  }),
  E({
    key: 'lying-leg-curl', dbId: 'Lying_Leg_Curls', name: 'Lying leg curl',
    pattern: 'knee-flexion', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'lower',
    loads: ['knee', 'hip'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Hips pressed into the pad', 'Curl heels towards glutes', 'Slow on the way down'],
  }),
  E({
    key: 'seated-leg-curl', dbId: 'Seated_Leg_Curl', name: 'Seated leg curl',
    pattern: 'knee-flexion', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'lower',
    loads: ['knee'], unit: 'reps', tempo: '1 s down, 2 s up',
    cues: ['Thigh pad snug', 'Full range', 'No jerking'],
  }),
  E({
    key: 'seated-calf-raise', dbId: 'Seated_Calf_Raise', name: 'Seated calf raise',
    pattern: 'calf', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'lower',
    loads: ['ankle'], unit: 'reps', tempo: '1 s up, 1 s pause, 2 s down',
    cues: ['Full stretch at the bottom', 'Pause at the top', 'Balls of the feet on the edge'],
  }),
  E({
    key: 'leg-press-calf', dbId: 'Calf_Press_On_The_Leg_Press_Machine', name: 'Calf press on leg press',
    pattern: 'calf', locations: ['gym'], equipment: 'machine', kind: 'isolation', region: 'lower',
    loads: ['ankle'], unit: 'reps', tempo: '1 s up, 1 s pause, 2 s down',
    cues: ['Keep the safety catches on', 'Knees soft, not locked', 'Only the ankles move'],
  }),
  E({
    key: 'cable-crunch', dbId: 'Cable_Crunch', name: 'Kneeling cable crunch',
    pattern: 'core-flexion', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'core',
    loads: ['core', 'lower-back'], unit: 'reps', tempo: '1 s down, 2 s up',
    cues: ['Hips stay still', 'Curl ribs towards hips', 'Exhale hard at the bottom'],
  }),
  E({
    key: 'pallof-press', dbId: 'Pallof_Press', name: 'Pallof press',
    pattern: 'core-stability', locations: ['gym'], equipment: 'cable', kind: 'isolation', region: 'core',
    loads: ['core'], unit: 'reps', tempo: '2 s hold at full reach',
    cues: ['Stand side-on to the cable', 'Press straight out and resist the twist', 'Hips and shoulders square'],
  }),
  E({
    key: 'goblet-squat', dbId: 'Goblet_Squat', name: 'Goblet squat (dumbbell)',
    variationNote: 'Pictured with a kettlebell — hold one dumbbell vertically at your chest instead.',
    pattern: 'squat', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'lower-back'], unit: 'reps', tempo: '3 s down, 1 s up',
    cues: ['Weight held at the chest, elbows down', 'Sit between your heels, chest up', 'Knees track over toes'],
  }),
  E({
    key: 'db-rdl', dbId: 'Stiff-Legged_Dumbbell_Deadlift', name: 'Dumbbell Romanian deadlift', perHand: true,
    pattern: 'hinge', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'lower',
    loads: ['lower-back', 'hip', 'knee'], unit: 'reps', tempo: '3 s down, 1 s up',
    cues: ['Soft knees, push hips back', 'Dumbbells slide down the thighs', 'Stop at mid-shin with a flat back'],
  }),
  E({
    key: 'db-reverse-lunge', dbId: 'Dumbbell_Rear_Lunge', name: 'Dumbbell reverse lunge', perHand: true,
    pattern: 'lunge', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'ankle'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Step back, not forward — kinder on the knees', 'Front shin near vertical', 'Reps are per leg'],
  }),
  E({
    key: 'db-split-squat', dbId: 'Split_Squat_with_Dumbbells', name: 'Dumbbell split squat', perHand: true,
    pattern: 'lunge', locations: ['gym'], equipment: 'dumbbell', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'ankle'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Feet stay planted', 'Drop the back knee straight down', 'Hold a wall if balance is off'],
  }),
  E({
    key: 'db-standing-calf', dbId: 'Standing_Dumbbell_Calf_Raise', name: 'Standing dumbbell calf raise', perHand: true,
    pattern: 'calf', locations: ['gym'], equipment: 'dumbbell', kind: 'isolation', region: 'lower',
    loads: ['ankle'], unit: 'reps', tempo: '1 s up, 1 s pause, 2 s down',
    cues: ['Stand on a step edge for range', 'Pause at the top', 'Slow lower'],
  }),

  // ───────────── CARDIO ─────────────
  E({
    key: 'incline-treadmill-walk', dbId: 'Walking_Treadmill', name: 'Incline treadmill walk (zone 2)',
    pattern: 'cardio', locations: ['gym'], equipment: 'cardio-machine', kind: 'cardio', region: 'full',
    loads: ['knee', 'ankle', 'hip'], unit: 'minutes', tempo: 'Steady — you can talk in full sentences',
    cues: ['Incline 6–10 %, speed 4.5–5.5 km/h', 'Do not hold the handrails', 'Zone 2: breathing up, still able to talk'],
  }),
  E({
    key: 'stationary-cycle', dbId: 'Bicycling_Stationary', name: 'Stationary cycle (zone 2)',
    pattern: 'cardio', locations: ['gym'], equipment: 'cardio-machine', kind: 'cardio', region: 'full',
    loads: ['knee'], unit: 'minutes', tempo: 'Steady — you can talk in full sentences',
    cues: ['Saddle at hip height', 'Slight knee bend at the bottom', 'Cadence 70–90 rpm, moderate resistance'],
  }),
  E({
    key: 'brisk-walk', dbId: 'Trail_Running_Walking', name: 'Brisk walk (outdoors)',
    variationNote: 'Pictured as a trail run — walk briskly on flat ground instead; no running for now.',
    instructionsOverride: [
      'Wear supportive shoes and pick a flat, safe route (park, track, society compound, or mall corridors).',
      'Walk briskly: breathing faster but you can still talk in full sentences (zone 2).',
      'Swing your arms and keep a tall posture.',
      'Keep it continuous; slow down rather than stop if you need to.',
    ],
    pattern: 'cardio', locations: ['home'], equipment: 'bodyweight', kind: 'cardio', region: 'full',
    loads: ['knee', 'ankle', 'hip'], unit: 'minutes', tempo: 'Steady, conversational pace',
    cues: ['About 100–120 steps per minute', 'Heel-to-toe, relaxed shoulders', 'Hydrate before and after'],
  }),

  // ───────────── HOME (bodyweight) ─────────────
  E({
    key: 'wall-push-up', dbId: 'Incline_Push-Up', name: 'Wall push-up',
    variationNote: 'Pictured on a bench — do it with hands on a wall at shoulder height.',
    instructionsOverride: [
      'Stand an arm’s length from a wall. Place your hands on the wall at shoulder height, slightly wider than your shoulders.',
      'Keep your body in a straight line from head to heels and brace your stomach.',
      'Bend your elbows to bring your chest towards the wall.',
      'Push back to straight arms. That is one rep.',
    ],
    pattern: 'horizontal-push', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s in, 1 s out',
    cues: ['Body stays straight like a plank', 'Elbows about 45° from your body', 'Step further back to make it harder'],
  }),
  E({
    key: 'incline-push-up', dbId: 'Incline_Push-Up', name: 'Incline push-up (hands on chair/bed)',
    variationNote: 'Use a sturdy chair pushed against a wall, a bed edge or a kitchen counter.',
    pattern: 'horizontal-push', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Chair against a wall so it cannot slide', 'Straight body line', 'Lower until chest is close to the edge'],
  }),
  E({
    key: 'knee-push-up', dbId: 'Pushups', name: 'Knee push-up',
    variationNote: 'Pictured as a full push-up — keep your knees on the floor (use a folded towel under them).',
    pattern: 'horizontal-push', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Straight line from knees to head', 'Hands just wider than shoulders', 'Chest goes to the floor, not the head'],
  }),
  E({
    key: 'push-up', dbId: 'Pushups', name: 'Push-up',
    pattern: 'horizontal-push', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'upper',
    loads: ['chest', 'shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Squeeze glutes and brace abs', 'Elbows about 45°', 'Full range: chest close to the floor'],
  }),
  E({
    key: 'chair-dip', dbId: 'Bench_Dips', name: 'Chair dip (feet close, knees bent)',
    variationNote: 'Use a sturdy chair against a wall. Keep knees bent and feet close to make it easier.',
    pattern: 'triceps', locations: ['home'], equipment: 'bodyweight', kind: 'isolation', region: 'upper',
    loads: ['shoulder', 'elbow', 'wrist'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Only lower until upper arms are parallel to the floor', 'Shoulders down, away from ears', 'Skip if the front of the shoulder hurts'],
  }),
  E({
    key: 'towel-triceps', dbId: 'Standing_Towel_Triceps_Extension', name: 'Towel triceps extension',
    pattern: 'triceps', locations: ['home'], equipment: 'bodyweight', kind: 'isolation', region: 'upper',
    loads: ['elbow', 'shoulder'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Bottom hand resists so the top arm has to work', 'Elbow points up', 'Switch arms each set'],
  }),
  E({
    key: 'towel-row', dbId: 'Suspended_Row', name: 'Towel row',
    variationNote: 'Pictured with straps — loop a strong towel round a solid pillar, railing or bed post instead.',
    instructionsOverride: [
      'Loop a strong bath towel round something that cannot move: a pillar, a fixed railing, or a heavy bed post.',
      'Hold one end of the towel in each hand, feet close to the anchor, and lean back with straight arms.',
      'Keeping your body straight, pull your chest towards your hands by bending your elbows and squeezing your shoulder blades.',
      'Lower slowly back to straight arms. Walk your feet further forward to make it harder.',
    ],
    pattern: 'horizontal-pull', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'upper',
    loads: ['upper-back', 'elbow', 'wrist'], unit: 'reps', tempo: '1 s pull, 2 s lower',
    cues: ['Test the anchor before every set', 'Body straight, hips do not sag', 'Squeeze shoulder blades at the top'],
  }),
  E({
    key: 'reverse-snow-angel', dbId: 'Superman', name: 'Reverse snow angel',
    variationNote: 'Pictured as a Superman — keep your legs down and move only your arms.',
    instructionsOverride: [
      'Lie face down, forehead resting on a folded towel, arms by your sides with palms facing down.',
      'Lift your hands and chest slightly off the floor and squeeze your shoulder blades together.',
      'Keeping your arms just off the floor, sweep them out to the sides and overhead, like making a snow angel.',
      'Sweep them back down to your hips. That is one rep.',
    ],
    pattern: 'rear-delt', locations: ['home'], equipment: 'bodyweight', kind: 'isolation', region: 'upper',
    loads: ['shoulder', 'upper-back', 'neck'], unit: 'reps', tempo: '3 s each way',
    cues: ['Look at the floor, not forward', 'Move slowly', 'Thumbs point up as hands go overhead'],
  }),
  E({
    key: 'superman', dbId: 'Superman', name: 'Superman hold',
    pattern: 'back-extension', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'isolation', region: 'core',
    loads: ['lower-back', 'neck'], unit: 'reps', tempo: '2 s hold at the top',
    cues: ['Lift only a few centimetres', 'Squeeze glutes', 'Breathe out as you lift'],
  }),
  E({
    key: 'chair-squat', dbId: 'Dumbbell_Squat_To_A_Bench', name: 'Chair-assisted squat',
    variationNote: 'Pictured with dumbbells and a bench — use no weight and sit back to a chair.',
    instructionsOverride: [
      'Stand in front of a sturdy chair (against a wall), feet shoulder-width apart, arms out in front for balance.',
      'Push your hips back and bend your knees to lower yourself slowly until you lightly touch the seat.',
      'Without relaxing onto the chair, drive through your heels to stand back up.',
      'Squeeze your glutes at the top.',
    ],
    pattern: 'squat', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip'], unit: 'reps', tempo: '3 s down, 1 s up',
    cues: ['Touch the chair, do not plop', 'Knees follow your toes', 'Chest proud'],
  }),
  E({
    key: 'bodyweight-squat', dbId: 'Bodyweight_Squat', name: 'Bodyweight squat',
    pattern: 'squat', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Heels stay down', 'Hips back and down', 'Go only as low as you can with a flat back'],
  }),
  E({
    key: 'tempo-squat', dbId: 'Bodyweight_Squat', name: 'Slow-tempo squat (4 s down)',
    variationNote: 'Same movement as the bodyweight squat, but take 4 seconds to lower and pause 1 second at the bottom.',
    pattern: 'squat', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip'], unit: 'reps', tempo: '4 s down, 1 s pause, 1 s up',
    cues: ['Count the 4 seconds out loud', 'Pause without bouncing', 'Stand up smoothly'],
  }),
  E({
    key: 'split-squat', dbId: 'Split_Squat_with_Dumbbells', name: 'Split squat (bodyweight)',
    variationNote: 'Pictured with dumbbells — do it with no weight, a hand on a wall for balance if needed.',
    pattern: 'lunge', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'ankle'], unit: 'reps', tempo: '2 s down, 1 s up',
    cues: ['Long stance, feet hip-width apart', 'Back knee straight down', 'Reps are per leg'],
  }),
  E({
    key: 'step-up', dbId: 'Dumbbell_Step_Ups', name: 'Stair step-up',
    variationNote: 'Pictured with dumbbells — use the bottom stair, no weights, hold the railing.',
    pattern: 'lunge', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['knee', 'hip', 'ankle'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Whole foot on the step', 'Push through the heel of the top leg', 'Step down slowly; reps are per leg'],
  }),
  E({
    key: 'glute-bridge', dbId: 'Butt_Lift_Bridge', name: 'Glute bridge',
    pattern: 'glute-bridge', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['hip', 'lower-back'], unit: 'reps', tempo: '1 s up, 2 s hold, 2 s down',
    cues: ['Push through the heels', 'Squeeze glutes at the top — do not arch the back', 'Ribs down'],
  }),
  E({
    key: 'single-leg-glute-bridge', dbId: 'Single_Leg_Glute_Bridge', name: 'Single-leg glute bridge',
    pattern: 'glute-bridge', locations: ['home'], equipment: 'bodyweight', kind: 'compound', region: 'lower',
    loads: ['hip', 'lower-back'], unit: 'reps', tempo: '1 s up, 2 s hold, 2 s down',
    cues: ['Hips stay level', 'Drive through the planted heel', 'Reps are per leg'],
  }),
  E({
    key: 'standing-calf-raise-home', dbId: 'Standing_Dumbbell_Calf_Raise', name: 'Stair calf raise (bodyweight)',
    variationNote: 'Pictured with dumbbells — stand on a stair edge with no weight, holding the railing.',
    pattern: 'calf', locations: ['home'], equipment: 'bodyweight', kind: 'isolation', region: 'lower',
    loads: ['ankle'], unit: 'reps', tempo: '1 s up, 1 s pause, 2 s down',
    cues: ['Heels drop below the step', 'Pause at the top', 'Hold the railing'],
  }),
  E({
    key: 'dead-bug', dbId: 'Dead_Bug', name: 'Dead bug',
    pattern: 'core-stability', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'isolation', region: 'core',
    loads: ['core'], unit: 'reps', tempo: '3 s each side',
    cues: ['Lower back pressed into the floor', 'Move opposite arm and leg slowly', 'Breathe out as you extend'],
  }),
  E({
    key: 'plank', dbId: 'Plank', name: 'Plank (forearms)',
    pattern: 'core-stability', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'isolation', region: 'core',
    loads: ['core', 'shoulder', 'lower-back'], unit: 'seconds', tempo: 'Hold',
    cues: ['Straight line from head to heels', 'Squeeze glutes, tuck ribs', 'Drop to knees if the back sags'],
  }),
  E({
    key: 'side-plank', dbId: 'Side_Bridge', name: 'Side plank',
    instructionsOverride: [
      'Lie on your side with your elbow directly under your shoulder and your legs stacked (or bottom knee bent to make it easier).',
      'Brace your stomach and lift your hips so your body forms a straight line from head to feet.',
      'Hold without letting your hips drop. Breathe steadily.',
      'Lower with control and repeat on the other side. The time is per side.',
    ],
    pattern: 'core-stability', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'isolation', region: 'core',
    loads: ['core', 'shoulder', 'hip'], unit: 'seconds', tempo: 'Hold',
    cues: ['Elbow under shoulder', 'Hips high', 'Bend the bottom knee to make it easier'],
  }),
  E({
    key: 'reverse-crunch', dbId: 'Reverse_Crunch', name: 'Reverse crunch',
    pattern: 'core-flexion', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'isolation', region: 'core',
    loads: ['core', 'lower-back'], unit: 'reps', tempo: '1 s up, 2 s down',
    cues: ['Curl hips off the floor, do not swing', 'Hands by your sides for support', 'Slow lowering'],
  }),
  E({
    key: 'glute-kickback', dbId: 'Glute_Kickback', name: 'Kneeling glute kickback',
    pattern: 'glute-bridge', locations: ['home'], equipment: 'bodyweight', kind: 'isolation', region: 'lower',
    loads: ['hip', 'lower-back', 'wrist'], unit: 'reps', tempo: '1 s up, 1 s hold, 2 s down',
    cues: ['Towel under the knees', 'Do not arch the lower back', 'Reps are per leg'],
  }),

  // ───────────── WARM-UP ─────────────
  E({
    key: 'wu-arm-circles', dbId: 'Arm_Circles', name: 'Arm circles',
    pattern: 'warmup', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'upper',
    loads: ['shoulder'], unit: 'seconds', tempo: 'Easy', cues: ['Small to big circles', 'Both directions'],
  }),
  E({
    key: 'wu-hip-circles', dbId: 'Standing_Hip_Circles', name: 'Standing hip circles',
    pattern: 'warmup', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'lower',
    loads: ['hip'], unit: 'seconds', tempo: 'Easy', cues: ['Hands on hips', 'Both directions'],
  }),
  E({
    key: 'wu-cat-stretch', dbId: 'Cat_Stretch', name: 'Cat–cow',
    pattern: 'warmup', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'core',
    loads: ['lower-back', 'wrist'], unit: 'seconds', tempo: 'Slow, with breathing', cues: ['Round up on the exhale', 'Arch gently on the inhale'],
  }),
  E({
    key: 'wu-worlds-greatest', dbId: 'Worlds_Greatest_Stretch', name: 'World’s greatest stretch',
    pattern: 'warmup', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'full',
    loads: ['hip', 'knee'], unit: 'seconds', tempo: 'Slow', cues: ['Use a hand on the floor or a chair for support', 'Alternate sides'],
  }),
  E({
    key: 'wu-easy-cardio', dbId: 'Walking_Treadmill', name: 'Easy walk / march on the spot',
    variationNote: 'At home, march on the spot or walk around the house.',
    pattern: 'warmup', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'full',
    loads: ['knee', 'ankle'], unit: 'minutes', tempo: 'Easy', cues: ['Gradually raise the pace', 'Breathing slightly up'],
  }),

  // ───────────── COOL-DOWN ─────────────
  E({
    key: 'cd-hamstring', dbId: 'Hamstring_Stretch', name: 'Hamstring stretch',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'lower',
    loads: ['lower-back', 'knee'], unit: 'seconds', tempo: 'Hold 30 s per side', cues: ['No bouncing', 'Gentle stretch only'],
  }),
  E({
    key: 'cd-quad', dbId: 'Quad_Stretch', name: 'Quad stretch',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'lower',
    loads: ['knee'], unit: 'seconds', tempo: 'Hold 30 s per side', cues: ['Hold a wall for balance', 'Knees together'],
  }),
  E({
    key: 'cd-chest', dbId: 'Chest_And_Front_Of_Shoulder_Stretch', name: 'Chest and shoulder stretch',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'upper',
    loads: ['shoulder', 'chest'], unit: 'seconds', tempo: 'Hold 30 s', cues: ['Use a doorway or wall', 'Breathe slowly'],
  }),
  E({
    key: 'cd-childs-pose', dbId: 'Childs_Pose', name: 'Child’s pose',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'core',
    loads: ['knee'], unit: 'seconds', tempo: 'Hold 45 s', cues: ['Knees wide if your belly is in the way', 'Long slow breaths'],
  }),
  E({
    key: 'cd-calf', dbId: 'Calf_Stretch_Hands_Against_Wall', name: 'Calf stretch at the wall',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'lower',
    loads: ['ankle'], unit: 'seconds', tempo: 'Hold 30 s per side', cues: ['Back heel down', 'Back knee straight'],
  }),
  E({
    key: 'cd-hip-flexor', dbId: 'Kneeling_Hip_Flexor', name: 'Kneeling hip-flexor stretch',
    pattern: 'cooldown', locations: ['home', 'gym'], equipment: 'bodyweight', kind: 'mobility', region: 'lower',
    loads: ['hip', 'knee'], unit: 'seconds', tempo: 'Hold 30 s per side', cues: ['Towel under the knee', 'Tuck the pelvis, squeeze the glute'],
  }),
];

export const CATALOG_BY_KEY: Record<string, CatalogExercise> = Object.fromEntries(CATALOG.map((e) => [e.key, e]));

export function getExercise(key: string): CatalogExercise {
  const e = CATALOG_BY_KEY[key];
  if (!e) throw new Error(`Unknown exercise key: ${key}`);
  return e;
}

/** Alternatives for the Swap button: same movement pattern, available at the same location. */
export function alternativesFor(key: string, location: Location): CatalogExercise[] {
  const ex = getExercise(key);
  return CATALOG.filter((c) => c.key !== key && c.pattern === ex.pattern && c.locations.includes(location));
}
