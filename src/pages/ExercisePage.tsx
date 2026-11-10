import { Link, useParams } from 'react-router-dom';
import { CATALOG_BY_KEY } from '../data/catalog';
import { ExerciseCard } from '../components/ExerciseCard';
import { H1 } from '../components/ui';

export default function ExercisePage() {
  const { key = '' } = useParams();
  const ex = CATALOG_BY_KEY[key];
  if (!ex) return <p className="text-muted">Unknown exercise.</p>;
  return (
    <div className="space-y-4">
      <button onClick={() => history.back()} className="min-h-11 text-accent">
        ‹ Back
      </button>
      <H1>{ex.name}</H1>
      <ExerciseCard exerciseKey={key} />
      <Link to="/library" className="block text-sm text-accent">
        All exercises
      </Link>
    </div>
  );
}
