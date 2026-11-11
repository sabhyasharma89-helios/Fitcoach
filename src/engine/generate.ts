import { CATALOG, getExercise, type BodyPart, type CatalogExercise, type Location } from '../data/catalog';
import { weekdayIndex, type DayKey } from '../lib/date';
import { isLoadBearing, roundLoad, SEED_LOADS } from './progression';
import { highImpactAllowed, isDeloadWeek, nextStrengthSlot, scheduledDayType, weekNumber } from './schedule';
import {
  COOLDOWN_KEYS,
  LADDER_BY_ID,
  STRENGTH_ROTATION,
  TEMPLATE_BY_KEY,
  WARMUP_KEYS,
  type Ladder,
} from './templates';
import type {
  CheckIn,
  ExerciseState,
  LadderState,
  PlannedExercise,
  PlannedItem,
  PlannedSession,
  SessionRecord,
  SessionTemplate,
  SlotMinutes,
  WeeklySchedule,
} from './types';

export interface GenerateInput {
  date: DayKey;
  checkIn: CheckIn;
  schedule: WeeklySchedule;
  startDate: DayKey;
  history: Pick<SessionRecord, 'date' | 'slot' | 'kind' | 'endedAt'>[];
  exerciseState: Record<string, ExerciseState>;
  ladderState: Record<string, LadderState>;
  /** consecutive missed training days before this date */
  missedStreak: number;
  /** override the rotation slot (used for previewing future days) */
  slotOverride?: number;
}

/** Seconds of work per set, used for time estimates. */
const SEC_PER_REP = 4;
const TRANSITION_SEC = 30;

export function warmupMinutes(m: SlotMinutes): number {
  return m >= 45 ? 7 : 5;
}
export function cooldownMinutes(m: SlotMinutes): number {
  return m >= 45 ? 5 : 3;
}

function workSec(ex: PlannedExercise): number {
  if (ex.unit === 'minutes') return ex.reps[1] * 60;
  if (ex.unit === 'seconds') return ex.reps[1] * (ex.key === 'side-plank' ? 2 : 1) // side plank is per side;
  return Math.round((ex.reps[0] + ex.reps[1]) / 2) * SEC_PER_REP;
}

/** Estimated minutes for the main block. */
export function estimateMainMinutes(main: PlannedExercise[], format: PlannedSession['format']): number {
  let sec = 0;
  if (format === 'straight') {
    for (const ex of main) sec += ex.sets * (workSec(ex) + ex.restSec) + TRANSITION_SEC;
  } else {
    // supersets/circuits: exercises within a group are back-to-back, rest after each round
    const groups = new Map<string, PlannedExercise[]>();
    for (const ex of main) {
      const g = ex.group ?? ex.key;
      groups.set(g, [...(groups.get(g) ?? []), ex]);
    }
    for (const exs of groups.values()) {
      const rounds = Math.max(...exs.map((e) => e.sets));
      const roundWork = exs.reduce((s, e) => s + workSec(e) + 10, 0);
      const roundRest = Math.max(...exs.map((e) => e.restSec));
      sec += rounds * (roundWork + roundRest) + TRANSITION_SEC;
    }
  }
  return Math.ceil(sec / 60);
}

function ladderStep(ladder: Ladder, state: LadderState | undefined) {
  const level = Math.min(state?.level ?? 0, ladder.steps.length - 1);
  return { level, step: ladder.steps[level] };
}

function plannedFrom(
  ex: CatalogExercise,
  sets: number,
  reps: [number, number],
  restSec: number,
  exerciseState: Record<string, ExerciseState>,
  ladder?: string,
): PlannedExercise {
  let load: number | null = null;
  let calibration = false;
  if (isLoadBearing(ex)) {
    load = exerciseState[ex.key]?.load ?? SEED_LOADS[ex.key] ?? null;
    calibration = load == null;
  }
  return {
    key: ex.key,
    name: ex.name,
    sets,
    reps,
    unit: ex.unit,
    load,
    perHand: !!ex.perHand,
    calibration,
    restSec,
    tempo: ex.tempo,
    role: ex.kind === 'cardio' ? 'cardio' : ex.kind === 'isolation' ? 'isolation' : 'compound',
    ladder,
    note: calibration
      ? 'Calibration: first time — find the load you can lift for 10 good reps (RPE 7–8) and log it. That becomes your starting load.'
      : undefined,
  };
}

function buildMain(t: SessionTemplate, input: GenerateInput): PlannedExercise[] {
  return t.slots.map((s) => {
    if (s.ladder) {
      const ladder = LADDER_BY_ID[s.ladder];
      const { level, step } = ladderStep(ladder, input.ladderState[s.ladder]);
      const p = plannedFrom(getExercise(step.exercise), s.sets, step.reps, s.restSec, input.exerciseState, s.ladder);
      p.note = `${ladder.name}: step ${level + 1} of ${ladder.steps.length}. Move up when you hit ${s.sets >= 3 ? 3 : s.sets} × ${step.reps[1]}${getExercise(step.exercise).unit === 'seconds' ? ' s' : ''}.`;
      return p;
    }
    return plannedFrom(getExercise(s.exercise!), s.sets, s.reps, s.restSec, input.exerciseState);
  });
}

const loadsAny = (ex: CatalogExercise, parts: BodyPart[]) => ex.loads.some((p) => parts.includes(p));

/** Replace one planned exercise with another (Swap button); keeps sets/reps/rest. */
export function swapPlanned(p: PlannedExercise, newKey: string, exerciseState: Record<string, ExerciseState>): PlannedExercise {
  const np = plannedFrom(getExercise(newKey), p.sets, p.reps, p.restSec, exerciseState);
  return { ...np, group: p.group, swappedFrom: p.swappedFrom ?? p.key };
}

/** Pain: remove exercises that load the painful area and swap in safe alternatives. */
export function applyPain(main: PlannedExercise[], pain: BodyPart[], location: Location, input: GenerateInput, notes: string[]): PlannedExercise[] {
  if (!pain.length) return main;
  const used = new Set(main.map((m) => m.key));
  const out: PlannedExercise[] = [];
  for (const p of main) {
    const ex = getExercise(p.key);
    if (!loadsAny(ex, pain)) {
      out.push(p);
      continue;
    }
    const alt = CATALOG.find(
      (c) =>
        c.pattern === ex.pattern &&
        c.locations.includes(location) &&
        !used.has(c.key) &&
        !loadsAny(c, pain) &&
        (!c.highImpact || highImpactAllowed(input.startDate, input.date)),
    );
    if (alt) {
      used.add(alt.key);
      const np = plannedFrom(alt, p.sets, p.reps, p.restSec, input.exerciseState);
      np.swappedFrom = p.key;
      np.note = `Swapped in for ${ex.name} because of pain.${np.calibration ? ' ' + np.note : ''}`;
      out.push(np);
      notes.push(`${ex.name} → ${alt.name} (doesn't load the painful area).`);
    } else {
      notes.push(`Removed ${ex.name}: it loads the painful area and there is no safe swap today.`);
    }
  }
  return out;
}

/** Sore: same exercises, fewer sets and ~10 % lighter for the sore area. */
function applySore(main: PlannedExercise[], sore: BodyPart[], notes: string[]): PlannedExercise[] {
  if (!sore.length) return applyTired(main, notes);
  let changed = false;
  const out = main.map((p) => {
    if (!loadsAny(getExercise(p.key), sore)) return p;
    changed = true;
    return { ...p, sets: Math.min(p.sets, 2), load: p.load != null ? roundLoad(p.load * 0.9) : null, note: 'Sore area: 2 lighter sets, stop at RPE 7.' };
  });
  if (changed) notes.push('Sore: exercises for the sore area are cut to 2 lighter sets.');
  return out;
}

function applyTired(main: PlannedExercise[], notes: string[]): PlannedExercise[] {
  notes.push('Tired: one set fewer on accessories; stop every set at RPE 7 (3 reps in reserve).');
  return main.map((p) => (p.role === 'isolation' && p.sets > 2 ? { ...p, sets: p.sets - 1 } : p));
}

/** Coming back after 3+ missed days: cut total working sets to ~80 %, accessories first. */
export function reduceVolume(main: PlannedExercise[], factor = 0.8): PlannedExercise[] {
  const total = main.reduce((s, p) => s + p.sets, 0);
  let toRemove = total - Math.round(total * factor);
  const out = main.map((p) => ({ ...p }));
  // remove from the last exercises first (accessories sit at the end), then compounds
  for (const pass of ['isolation', 'compound'] as const) {
    for (let i = out.length - 1; i >= 0 && toRemove > 0; i--) {
      if (out[i].role === pass && out[i].sets > 1) {
        out[i].sets--;
        toRemove--;
      }
    }
  }
  for (let i = out.length - 1; i >= 0 && toRemove > 0; i--) {
    if (out[i].sets > 1) {
      out[i].sets--;
      toRemove--;
    }
  }
  return out;
}

function applyDeload(main: PlannedExercise[]): PlannedExercise[] {
  return main.map((p) =>
    p.role === 'cardio'
      ? p
      : {
          ...p,
          sets: Math.min(p.sets, 2),
          load: p.load != null && !p.calibration ? roundLoad(p.load * 0.9) : p.load,
          note: [p.note, 'Deload week: 2 sets, about 10 % lighter.'].filter(Boolean).join(' '),
        },
  );
}

/**
 * Fit a strength session into the time slot:
 * 1) drop accessories (isolation lifts) from the end, keeping compounds;
 * 2) if still too long, convert to supersets (pairs back-to-back);
 * 3) if still too long, cap every exercise at 2 sets.
 */
export function fitToTime(
  main: PlannedExercise[],
  minutes: SlotMinutes,
  baseFormat: 'straight' | 'circuit',
  notes: string[],
): { main: PlannedExercise[]; format: PlannedSession['format'] } {
  const budget = minutes - warmupMinutes(minutes) - cooldownMinutes(minutes);
  let out = main.map((p) => ({ ...p }));
  let format: PlannedSession['format'] = baseFormat;
  if (baseFormat === 'circuit') out = out.map((p) => ({ ...p, group: 'circuit' }));
  if (minutes >= 60 && baseFormat === 'straight') return { main: out, format };

  const removed: string[] = [];
  while (estimateMainMinutes(out, format) > budget) {
    const idx = [...out].reverse().findIndex((p) => p.role === 'isolation');
    if (idx === -1 || out.length <= 2) break;
    const realIdx = out.length - 1 - idx;
    removed.push(out[realIdx].name);
    out.splice(realIdx, 1);
  }
  if (removed.length) notes.push(`Short on time: dropped ${removed.join(', ')}. Compound lifts kept.`);

  if (estimateMainMinutes(out, format) > budget && format === 'straight') {
    format = 'superset';
    out = out.map((p, i) => ({ ...p, group: String.fromCharCode(65 + Math.floor(i / 2)), restSec: Math.min(p.restSec, 90) }));
    notes.push('Run as supersets: do each pair (A1 → A2) back-to-back, then rest.');
  }
  if (estimateMainMinutes(out, format) > budget) {
    out = out.map((p) => (p.unit === 'minutes' ? p : { ...p, sets: Math.min(p.sets, 2) }));
    notes.push('Capped at 2 sets per exercise to fit the time.');
  }
  if (estimateMainMinutes(out, format) > budget) {
    // one circuit: every exercise back-to-back, rest only after the full round
    format = 'circuit';
    out = out.map((p) => ({ ...p, group: 'circuit', restSec: 90 }));
    const i = notes.findIndex((n) => n.startsWith('Run as supersets'));
    if (i >= 0) notes.splice(i, 1);
    notes.push('Run as one circuit: one set of each exercise back-to-back, rest 90 s after each round.');
  }
  const dropped: string[] = [];
  while (estimateMainMinutes(out, format) > budget && out.length > 2) dropped.push(out.pop()!.name);
  if (dropped.length) notes.push(`Not enough time for ${dropped.join(', ')} today.`);
  return { main: out, format };
}

function warmup(minutes: SlotMinutes, location: Location, pain: BodyPart[]): PlannedItem[] {
  const total = warmupMinutes(minutes);
  const items: PlannedItem[] = [
    { key: 'wu-easy-cardio', name: location === 'gym' ? 'Easy walk on the treadmill' : 'March on the spot / walk around', dose: `${total - 3} min` },
    { key: 'wu-arm-circles', name: getExercise('wu-arm-circles').name, dose: '30 s' },
    { key: 'wu-hip-circles', name: getExercise('wu-hip-circles').name, dose: '30 s' },
    { key: 'wu-cat-stretch', name: getExercise('wu-cat-stretch').name, dose: '45 s' },
    { key: 'wu-worlds-greatest', name: getExercise('wu-worlds-greatest').name, dose: '30 s per side' },
  ];
  return items.filter((i) => WARMUP_KEYS.includes(i.key) && (i.key === 'wu-easy-cardio' || !loadsAny(getExercise(i.key), pain)));
}

function cooldown(minutes: SlotMinutes, pain: BodyPart[]): PlannedItem[] {
  const keys = minutes >= 45 ? COOLDOWN_KEYS : ['cd-hamstring', 'cd-quad', 'cd-chest', 'cd-childs-pose'];
  return keys
    .filter((k) => !loadsAny(getExercise(k), pain))
    .map((k) => ({ key: k, name: getExercise(k).name, dose: getExercise(k).tempo.replace('Hold ', '') }));
}

function emptySession(input: GenerateInput, title: string, notes: string[]): PlannedSession {
  return {
    date: input.date,
    kind: 'rest',
    templateKey: null,
    title,
    location: input.checkIn.location,
    minutes: input.checkIn.minutes,
    slot: null,
    format: 'straight',
    warmup: [],
    main: [],
    cooldown: [],
    notes,
    estimatedMin: 0,
    deload: false,
    reducedVolume: false,
    week: weekNumber(input.startDate, input.date),
  };
}

/** Produce today's exact session from the check-in. */
export function generateSession(input: GenerateInput): PlannedSession {
  const { checkIn, schedule, date } = input;
  const notes: string[] = [];
  const week = weekNumber(input.startDate, date);
  if (checkIn.location === 'rest') {
    return emptySession(input, 'Rest day', ['Rest day. An easy 20–30 minute walk is welcome but optional.']);
  }
  const dayType = scheduledDayType(schedule, date);
  const location: Location = checkIn.location === 'gym' ? 'gym' : 'home';
  if (checkIn.location === 'travel') notes.push('Hotel room: use the bed edge or a desk instead of a chair; a towel works for rows.');

  let template: SessionTemplate;
  let slot: number | null = null;
  if (dayType === 'cardio') {
    template = TEMPLATE_BY_KEY[location === 'gym' ? 'gym-zone2' : 'home-walk'];
  } else {
    // strength days — and rest days you chose to train on — take the next session in the rotation
    slot = input.slotOverride ?? nextStrengthSlot(input.history, date);
    template = TEMPLATE_BY_KEY[STRENGTH_ROTATION[slot][location]];
    if (dayType === 'rest') notes.push('Scheduled rest day — you chose to train, so this is the next session in your rotation.');
  }

  let main = buildMain(template, input);
  const deload = isDeloadWeek(input.startDate, date);
  const reducedVolume = input.missedStreak >= 3 && template.kind === 'strength';

  if (template.kind === 'cardio') {
    const budget = checkIn.minutes - warmupMinutes(checkIn.minutes) - cooldownMinutes(checkIn.minutes);
    const [lo, hi] = main[0].reps;
    const mins = Math.max(10, Math.min(hi, checkIn.minutes >= 60 ? hi : budget));
    main = [{ ...main[0], reps: [Math.min(lo, mins), mins] }];
    if (checkIn.feeling === 'tired' || checkIn.feeling === 'sore') notes.push('Keep it truly easy today — nose-breathing pace.');
    if (checkIn.feeling === 'pain' && checkIn.painParts.length) {
      main = applyPain(main, checkIn.painParts, location, input, notes);
    }
  } else {
    if (deload) {
      main = applyDeload(main);
      notes.push(`Week ${week} is a deload week: same exercises, 2 sets, about 10 % lighter.`);
    }
    if (reducedVolume) {
      main = reduceVolume(main, 0.8);
      notes.push(`Welcome back — you missed ${input.missedStreak} training days in a row, so today is at 80 % volume.`);
    }
    if (checkIn.feeling === 'tired') main = applyTired(main, notes);
    if (checkIn.feeling === 'sore') main = applySore(main, checkIn.soreParts, notes);
    if (checkIn.feeling === 'pain') {
      main = applyPain(main, checkIn.painParts, location, input, notes);
      notes.push('Pain: stop any exercise that makes it worse. If pain lasts more than a few days, see a doctor or physio.');
    }
  }

  if (!highImpactAllowed(input.startDate, date)) main = main.filter((p) => !getExercise(p.key).highImpact);

  let format: PlannedSession['format'] = 'straight';
  if (template.kind === 'strength') {
    const fitted = fitToTime(main, checkIn.minutes, template.format === 'circuit' ? 'circuit' : 'straight', notes);
    main = fitted.main;
    format = fitted.format;
    if (template.format === 'circuit') {
      notes.push('Circuit: do one set of each exercise in order with ~30 s between, rest 90 s after each round, 3 rounds.');
    }
  }

  const pain = checkIn.feeling === 'pain' ? checkIn.painParts : [];
  const wu = warmup(checkIn.minutes, location, pain);
  const cd = cooldown(checkIn.minutes, pain);
  if (template.kind === 'strength') notes.push('Effort guide: finish each set with 2–3 good reps left in the tank (RPE 7–8).');

  return {
    date,
    kind: template.kind,
    templateKey: template.key,
    title: template.name,
    location: checkIn.location,
    minutes: checkIn.minutes,
    slot,
    format,
    warmup: wu,
    main,
    cooldown: cd,
    notes,
    estimatedMin: warmupMinutes(checkIn.minutes) + estimateMainMinutes(main, format) + cooldownMinutes(checkIn.minutes),
    deload: deload && template.kind === 'strength',
    reducedVolume,
    week,
  };
}

/** Check-in used when you don't do one: location from the weekly schedule, default time, feeling normal. */
export function defaultCheckIn(schedule: WeeklySchedule, date: DayKey): CheckIn {
  const type = scheduledDayType(schedule, date);
  const idx = weekdayIndex(date);
  return {
    date,
    location: type === 'rest' ? 'rest' : schedule.defaultLocation[idx],
    minutes: schedule.defaultMinutes,
    feeling: 'normal',
    soreParts: [],
    painParts: [],
    auto: true,
  };
}

/**
 * Plan preview for future days: walk the rotation forward from the next slot.
 * Missed days do not consume slots, so this is the plan if you train as scheduled.
 */
export function previewDays(
  dates: DayKey[],
  base: Omit<GenerateInput, 'date' | 'checkIn' | 'slotOverride'>,
  checkIns: Map<DayKey, CheckIn> = new Map(),
): Map<DayKey, PlannedSession> {
  const out = new Map<DayKey, PlannedSession>();
  let slot = nextStrengthSlot(base.history, dates[0]);
  for (const date of dates) {
    const ci = checkIns.get(date) ?? defaultCheckIn(base.schedule, date);
    const s = generateSession({ ...base, date, checkIn: ci, slotOverride: slot, missedStreak: 0 });
    if (s.kind === 'strength') slot = (slot + 1) % STRENGTH_ROTATION.length;
    out.set(date, s);
  }
  return out;
}
