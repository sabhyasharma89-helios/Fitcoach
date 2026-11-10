import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomFood, type FoodLog, type Meal } from '../db/db';
import { addDaysKey, formatDay, todayKey } from '../lib/date';
import { fmtCm, fmtInt, fmtKg, round1 } from '../lib/format';
import { ageFrom, calorieTarget, FIBRE_TARGET_G, proteinTarget } from '../engine/nutrition';
import { stepTarget } from '../engine/steps';
import { BUNDLED_FOODS, customToFood, searchFoods, type Food } from '../food/foods';
import { scale, sumNutrients } from '../food/foodMath';
import { lookupBarcode } from '../food/off';
import { parseSamsungSteps } from '../lib/samsungCsv';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { Button, Card, Field, H1, H2, Notice, Segmented, Sheet, inputCls } from '../components/ui';
import { isNative, syncHealth } from '../health/health';

type Tab = 'food' | 'body' | 'steps';

export default function Log() {
  const [tab, setTab] = useState<Tab>('food');
  return (
    <div className="space-y-4">
      <H1>Log</H1>
      <Segmented
        name="Log section"
        options={[
          { value: 'food', label: 'Food' },
          { value: 'body', label: 'Weight & waist' },
          { value: 'steps', label: 'Steps' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'food' && <FoodTab />}
      {tab === 'body' && <BodyTab />}
      {tab === 'steps' && <StepsTab />}
    </div>
  );
}

const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const today = todayKey();
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" aria-label="Previous day" onClick={() => setDate(addDaysKey(date, -1))}>
        ‹
      </Button>
      <span className="font-medium">{date === today ? 'Today' : formatDay(date, 'EEE d MMM')}</span>
      <Button variant="ghost" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDaysKey(date, 1))}>
        ›
      </Button>
    </div>
  );
}

function FoodTab() {
  const [date, setDate] = useState(todayKey());
  const [adding, setAdding] = useState<Meal | null>(null);
  const [savingMeal, setSavingMeal] = useState<Meal | null>(null);
  const [usingSaved, setUsingSaved] = useState<Meal | null>(null);
  const d = useLiveQuery(async () => {
    const [logs, settings, water, savedMeals] = await Promise.all([
      db.foodLogs.where('date').equals(date).toArray(),
      db.settings.get('me'),
      db.water.get(date),
      db.savedMeals.toArray(),
    ]);
    return { logs, settings: settings!, water: water?.ml ?? 0, savedMeals };
  }, [date]);
  if (!d) return null;
  const s = d.settings;
  const kcalT = calorieTarget({ sex: s.sex, weightKg: s.calorieBasisKg ?? s.startWeightKg, heightCm: s.heightCm, age: ageFrom(s.birthYear, date), activity: s.activity });
  const protT = proteinTarget(s.goalWeightKg);
  const tot = sumNutrients(d.logs);

  const copyYesterday = async () => {
    const y = await db.foodLogs.where('date').equals(addDaysKey(date, -1)).toArray();
    if (!y.length) return alert('Nothing was logged yesterday.');
    await db.foodLogs.bulkAdd(y.map(({ id: _id, ...r }) => ({ ...r, date, at: Date.now() })));
  };

  return (
    <div className="space-y-4">
      <DateNav date={date} setDate={setDate} />
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Total label="kcal" v={tot.kcal} t={kcalT} />
          <Total label="protein g" v={tot.protein} t={protT} />
          <Total label="fibre g" v={tot.fibre ?? 0} t={FIBRE_TARGET_G} />
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Carbs {fmtInt(tot.carbs)} g · Fat {fmtInt(tot.fat)} g · Target {fmtInt(kcalT)} kcal (based on {fmtKg(s.calorieBasisKg ?? s.startWeightKg)} kg)
        </p>
      </Card>

      <Card>
        <H2 right={<span className="num text-sm text-muted">{fmtInt(d.water)} / {fmtInt(s.waterTargetMl)} ml</span>}>Water</H2>
        <div className="grid grid-cols-4 gap-2">
          {[250, 500].map((ml) => (
            <Button key={ml} onClick={() => db.water.put({ date, ml: d.water + ml })}>
              +{ml}
            </Button>
          ))}
          <Button onClick={() => db.water.put({ date, ml: Math.max(0, d.water - 250) })}>−250</Button>
          <Button onClick={() => db.water.put({ date, ml: 0 })}>Reset</Button>
        </div>
      </Card>

      {MEALS.map((m) => {
        const items = d.logs.filter((l) => l.meal === m.id);
        const mt = sumNutrients(items);
        return (
          <Card key={m.id}>
            <H2 right={<span className="num text-sm text-muted">{fmtInt(mt.kcal)} kcal · {fmtInt(mt.protein)} g P</span>}>{m.label}</H2>
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{it.name}</div>
                    <div className="text-xs text-muted">{it.amount}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num text-muted">{fmtInt(it.kcal)}</span>
                    <button aria-label={`Delete ${it.name}`} className="min-h-11 min-w-11 text-muted" onClick={() => db.foodLogs.delete(it.id!)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button variant="primary" onClick={() => setAdding(m.id)}>
                + Add
              </Button>
              <Button onClick={() => setUsingSaved(m.id)} disabled={!d.savedMeals.length}>
                My meals
              </Button>
              <Button onClick={() => setSavingMeal(m.id)} disabled={!items.length}>
                Save meal
              </Button>
            </div>
          </Card>
        );
      })}

      <Button className="w-full" onClick={copyYesterday}>
        Copy yesterday’s food to {date === todayKey() ? 'today' : formatDay(date, 'd MMM')}
      </Button>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={`Add to ${MEALS.find((m) => m.id === adding)?.label ?? ''}`}>
        {adding && <AddFood date={date} meal={adding} onDone={() => setAdding(null)} />}
      </Sheet>
      <Sheet open={!!savingMeal} onClose={() => setSavingMeal(null)} title="Save as a usual meal">
        {savingMeal && <SaveMeal items={d.logs.filter((l) => l.meal === savingMeal)} onDone={() => setSavingMeal(null)} />}
      </Sheet>
      <Sheet open={!!usingSaved} onClose={() => setUsingSaved(null)} title="My usual meals">
        <ul className="space-y-2">
          {d.savedMeals.map((sm) => (
            <li key={sm.id} className="flex items-center gap-2">
              <Button
                className="flex-1 text-left"
                onClick={async () => {
                  await db.foodLogs.bulkAdd(sm.items.map((i) => ({ ...i, meal: usingSaved!, date, at: Date.now() })));
                  setUsingSaved(null);
                }}
              >
                {sm.name} · {fmtInt(sumNutrients(sm.items).kcal)} kcal
              </Button>
              <button aria-label={`Delete ${sm.name}`} className="min-h-11 min-w-11 text-muted" onClick={() => db.savedMeals.delete(sm.id!)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function Total({ label, v, t }: { label: string; v: number; t: number }) {
  return (
    <div>
      <div className="num text-xl font-semibold">{fmtInt(v)}</div>
      <div className="text-xs text-muted">
        of {fmtInt(t)} {label}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, (v / t) * 100)}%` }} />
      </div>
    </div>
  );
}

function SaveMeal({ items, onDone }: { items: FoodLog[]; onDone: () => void }) {
  const [name, setName] = useState('My usual breakfast');
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="text-sm text-muted">{items.map((i) => i.name).join(', ')}</p>
      <Button
        variant="primary"
        className="w-full"
        onClick={async () => {
          await db.savedMeals.add({ name: name.trim() || 'My meal', items: items.map(({ id: _i, date: _d, at: _a, ...r }) => r) });
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

function AddFood({ date, meal, onDone }: { date: string; meal: Meal; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [mode, setMode] = useState<'search' | 'scan' | 'custom'>('search');
  const [status, setStatus] = useState<string | null>(null);
  const custom = useLiveQuery(() => db.customFoods.toArray(), []);
  const all = useMemo(() => [...(custom ?? []).map(customToFood), ...BUNDLED_FOODS], [custom]);
  const results = useMemo(() => searchFoods(q, all), [q, all]);

  if (picked) return <Amount food={picked} date={date} meal={meal} onBack={() => setPicked(null)} onDone={onDone} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Button variant={mode === 'search' ? 'primary' : 'secondary'} onClick={() => setMode('search')}>
          Search
        </Button>
        <Button variant={mode === 'scan' ? 'primary' : 'secondary'} onClick={() => setMode('scan')}>
          Scan
        </Button>
        <Button variant={mode === 'custom' ? 'primary' : 'secondary'} onClick={() => setMode('custom')}>
          Custom
        </Button>
      </div>
      {mode === 'search' && (
        <>
          <input autoFocus className={inputCls} placeholder="Search e.g. dal, roti, paneer" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="divide-y divide-line">
            {results.map((f) => (
              <li key={f.id}>
                <button className="flex w-full justify-between gap-2 py-3 text-left" onClick={() => setPicked(f)}>
                  <span>
                    <span className="block text-sm">{f.name}</span>
                    <span className="block text-xs text-muted">{f.category}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-muted">{fmtInt(f.per100.kcal)} kcal/100 g</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {mode === 'scan' && (
        <>
          <BarcodeScanner
            onCode={async (code) => {
              setStatus(`Looking up ${code}…`);
              const existing = await db.customFoods.where('barcode').equals(code.replace(/\D/g, '')).first();
              if (existing) return setPicked(customToFood(existing));
              try {
                const f = await lookupBarcode(code);
                if (!f) {
                  setStatus('Not found on Open Food Facts (or the label has no full nutrition). Add it as a custom food.');
                  setMode('custom');
                  return;
                }
                await db.customFoods.put(f);
                setPicked(customToFood(f));
              } catch (e) {
                setStatus(`Lookup failed: ${(e as Error).message}. Are you offline?`);
              }
            }}
          />
          {status && <p className="text-sm text-muted">{status}</p>}
        </>
      )}
      {mode === 'custom' && (
        <>
          {status && <Notice tone="warn">{status}</Notice>}
          <CustomFoodForm onSaved={(f) => setPicked(customToFood(f))} />
        </>
      )}
    </div>
  );
}

function Amount({ food, date, meal, onBack, onDone }: { food: Food; date: string; meal: Meal; onBack: () => void; onDone: () => void }) {
  const [unit, setUnit] = useState<'serving' | 'grams'>(food.serving ? 'serving' : 'grams');
  const [qty, setQty] = useState<number>(food.serving ? 1 : 100);
  const grams = unit === 'serving' && food.serving ? qty * food.serving.grams : qty;
  const n = scale(food.per100, grams);
  return (
    <div className="space-y-3">
      <button className="text-accent" onClick={onBack}>
        ‹ Back
      </button>
      <h3 className="text-lg font-semibold">{food.name}</h3>
      {food.serving && (
        <Segmented
          name="Unit"
          options={[
            { value: 'serving', label: food.serving.label },
            { value: 'grams', label: 'grams' },
          ]}
          value={unit}
          onChange={(u) => {
            setUnit(u);
            setQty(u === 'serving' ? 1 : food.serving!.grams);
          }}
        />
      )}
      <Field label={unit === 'serving' ? 'Number of servings' : 'Grams'}>
        <input
          className={inputCls}
          type="number"
          inputMode="decimal"
          min={0}
          step={unit === 'serving' ? 0.5 : 5}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </Field>
      <div className="grid grid-cols-5 gap-2 text-center text-sm">
        {(
          [
            ['kcal', n.kcal],
            ['protein', n.protein],
            ['carbs', n.carbs],
            ['fat', n.fat],
            ['fibre', n.fibre],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface-2 p-2">
            <div className="num font-semibold">{v == null ? '—' : fmtInt(v)}</div>
            <div className="text-[10px] text-muted">{k === 'kcal' ? 'kcal' : `${k} g`}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Source: {food.source}</p>
      <Button
        variant="primary"
        big
        className="w-full"
        disabled={!(grams > 0)}
        onClick={async () => {
          await db.foodLogs.add({
            date,
            meal,
            foodId: food.id,
            name: food.name,
            grams: round1(grams),
            amount: unit === 'serving' && food.serving ? `${qty} × ${food.serving.label}` : `${round1(grams)} g`,
            kcal: n.kcal,
            protein: n.protein,
            carbs: n.carbs,
            fat: n.fat,
            fibre: n.fibre,
            source: food.source,
            at: Date.now(),
          });
          onDone();
        }}
      >
        Add {fmtInt(n.kcal)} kcal
      </Button>
    </div>
  );
}

function CustomFoodForm({ onSaved }: { onSaved: (f: CustomFood) => void }) {
  const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '', servingG: '', servingLabel: '', source: 'Nutrition label' });
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const valid = f.name.trim() && [f.kcal, f.protein, f.carbs, f.fat].every((v) => v.trim() !== '' && Number(v) >= 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className={inputCls} value={f.name} onChange={set('name')} />
      </Field>
      <p className="text-sm text-muted">Values per 100 g (from the label)</p>
      <div className="grid grid-cols-2 gap-2">
        {(['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const).map((k) => (
          <Field key={k} label={k === 'kcal' ? 'kcal' : `${k} (g)`}>
            <input className={inputCls} type="number" inputMode="decimal" min={0} value={f[k]} onChange={set(k)} />
          </Field>
        ))}
        <Field label="Serving (g, optional)">
          <input className={inputCls} type="number" inputMode="decimal" min={0} value={f.servingG} onChange={set('servingG')} />
        </Field>
      </div>
      <Field label="Serving name (optional)">
        <input className={inputCls} placeholder="e.g. 1 scoop" value={f.servingLabel} onChange={set('servingLabel')} />
      </Field>
      <Field label="Where the values came from">
        <input className={inputCls} value={f.source} onChange={set('source')} />
      </Field>
      <Button
        variant="primary"
        className="w-full"
        disabled={!valid}
        onClick={async () => {
          const food: CustomFood = {
            id: `custom-${Date.now()}`,
            name: f.name.trim(),
            per100: { kcal: Number(f.kcal), protein: Number(f.protein), carbs: Number(f.carbs), fat: Number(f.fat), fibre: num(f.fibre) },
            servingG: Number(f.servingG) || 0,
            servingLabel: f.servingLabel.trim() || (Number(f.servingG) ? `${Number(f.servingG)} g` : ''),
            source: `My entry: ${f.source.trim() || 'not stated'}`,
            createdAt: Date.now(),
          };
          await db.customFoods.put(food);
          onSaved(food);
        }}
      >
        Save food
      </Button>
    </div>
  );
}

function BodyTab() {
  const today = todayKey();
  const d = useLiveQuery(async () => ({
    weights: await db.weights.orderBy('date').reverse().limit(14).toArray(),
    waists: await db.waists.orderBy('date').reverse().limit(8).toArray(),
  }));
  const [kg, setKg] = useState('');
  const [cm, setCm] = useState('');
  const [date, setDate] = useState(today);
  if (!d) return null;
  const kgN = Number(kg);
  const cmN = Number(cm);
  return (
    <div className="space-y-4">
      <DateNav date={date} setDate={setDate} />
      <Card>
        <H2>Weigh-in</H2>
        <p className="mb-2 text-xs text-muted">Same time each morning, after the toilet, before food.</p>
        <div className="flex gap-2">
          <input className={inputCls} type="number" inputMode="decimal" step={0.1} min={30} max={300} placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} />
          <Button
            variant="primary"
            disabled={!(kgN >= 30 && kgN <= 300)}
            onClick={async () => {
              await db.weights.put({ date, kg: round1(kgN), source: 'manual', at: Date.now() });
              setKg('');
            }}
          >
            Save
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {d.weights.map((w) => (
            <li key={w.date} className="flex justify-between py-2">
              <span>{formatDay(w.date)}</span>
              <span className="num">
                {fmtKg(w.kg)} kg {w.source === 'healthconnect' && <span className="text-xs text-muted">· Health Connect</span>}
                <button aria-label={`Delete weight ${w.date}`} className="ml-2 min-h-8 text-muted" onClick={() => db.weights.delete(w.date)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <H2>Waist (weekly)</H2>
        <p className="mb-2 text-xs text-muted">Measure at the belly button, relaxed, after breathing out. Indian men: above 90 cm is a higher-risk zone.</p>
        <div className="flex gap-2">
          <input className={inputCls} type="number" inputMode="decimal" step={0.1} min={40} max={250} placeholder="cm" value={cm} onChange={(e) => setCm(e.target.value)} />
          <Button
            variant="primary"
            disabled={!(cmN >= 40 && cmN <= 250)}
            onClick={async () => {
              await db.waists.put({ date, cm: round1(cmN) });
              setCm('');
            }}
          >
            Save
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {d.waists.map((w) => (
            <li key={w.date} className="flex justify-between py-2">
              <span>{formatDay(w.date)}</span>
              <span className="num">
                {fmtCm(w.cm)} cm
                <button aria-label={`Delete waist ${w.date}`} className="ml-2 min-h-8 text-muted" onClick={() => db.waists.delete(w.date)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StepsTab() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [count, setCount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = useLiveQuery(() => db.steps.where('date').between(addDaysKey(today, -30), today, true, true).reverse().toArray(), [today]);
  if (!steps) return null;
  const target = stepTarget(new Map(steps.map((s) => [s.date, s.count])), today);
  return (
    <div className="space-y-4">
      <Card>
        <H2>Daily target: {fmtInt(target.target)}</H2>
        <p className="text-xs text-muted">
          {target.basisAvg != null
            ? `Last week averaged ${fmtInt(target.basisAvg)} steps/day. Target = average + 1,000 (max 10,000), reset every Monday.`
            : 'Starting target 5,000 until there is a week of step data.'}
        </p>
      </Card>
      {isNative() && (
        <Button
          variant="primary"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await syncHealth();
              setMsg(r.errors.length ? r.errors.join(' ') : `Synced ${r.stepsDays} days from Health Connect.`);
            } catch (e) {
              setMsg(String((e as Error).message ?? e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Syncing…' : 'Sync from Health Connect'}
        </Button>
      )}
      <Card>
        <H2>Enter steps</H2>
        <DateNav date={date} setDate={setDate} />
        <div className="mt-2 flex gap-2">
          <input className={inputCls} type="number" inputMode="numeric" min={0} placeholder="steps" value={count} onChange={(e) => setCount(e.target.value)} />
          <Button
            variant="primary"
            disabled={!(Number(count) >= 0 && count !== '')}
            onClick={async () => {
              await db.steps.put({ date, count: Math.round(Number(count)), source: 'manual' });
              setCount('');
            }}
          >
            Save
          </Button>
        </div>
      </Card>
      {!isNative() && (
        <Card>
          <H2>Import from Samsung Health</H2>
          <ol className="mb-2 list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>Samsung Health › ☰ Settings › Download personal data › Download.</li>
            <li>Open the exported folder (Files app › Internal storage › Download › Samsung Health).</li>
            <li>Pick the file named com.samsung.shealth.step_daily_trend.….csv below.</li>
          </ol>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:text-ink"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = parseSamsungSteps(await file.text());
                await db.transaction('rw', db.steps, async () => {
                  for (const r of rows) {
                    const ex = await db.steps.get(r.date);
                    if (ex?.source !== 'manual') await db.steps.put({ date: r.date, count: r.count, source: 'samsung-csv' });
                  }
                });
                setMsg(`Imported ${rows.length} days (${rows[0]?.date ?? ''} to ${rows[rows.length - 1]?.date ?? ''}). Days you typed in yourself were kept.`);
              } catch (err) {
                setMsg((err as Error).message);
              }
            }}
          />
        </Card>
      )}
      {msg && <Notice>{msg}</Notice>}
      <Card>
        <H2>Last 30 days</H2>
        <ul className="divide-y divide-line text-sm">
          {steps.map((s) => (
            <li key={s.date} className="flex justify-between py-2">
              <span>{formatDay(s.date)}</span>
              <span className="num">
                {fmtInt(s.count)} <span className="text-xs text-muted">{s.source === 'manual' ? '· typed' : s.source === 'healthconnect' ? '· Health Connect' : '· CSV'}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
