import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATALOG } from '../data/catalog';
import { resolveExercise } from '../data/exerciseDb';
import { H1, Segmented } from '../components/ui';

export default function Library() {
  const [loc, setLoc] = useState<'gym' | 'home'>('gym');
  const list = CATALOG.filter((c) => c.locations.includes(loc) && c.pattern !== 'warmup' && c.pattern !== 'cooldown');
  return (
    <div className="space-y-4">
      <H1>Exercise library</H1>
      <Segmented
        name="Location"
        options={[
          { value: 'gym', label: 'Gym' },
          { value: 'home', label: 'Home (no equipment)' },
        ]}
        value={loc}
        onChange={setLoc}
      />
      <ul className="grid grid-cols-2 gap-3">
        {list.map((c) => {
          const r = resolveExercise(c.key);
          return (
            <li key={c.key}>
              <Link to={`/exercise/${c.key}`} className="block overflow-hidden rounded-xl border border-line bg-surface">
                <img src={r.imageUrls[0]} alt="" loading="lazy" className="aspect-[4/3] w-full bg-white object-contain" />
                <div className="p-2 text-sm font-medium">{c.name}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
