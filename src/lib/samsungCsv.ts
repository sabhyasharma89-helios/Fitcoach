/**
 * Samsung Health "Download personal data" step files:
 *   com.samsung.shealth.step_daily_trend.<ts>.csv          (columns … source_type, count, … day_time)
 *   com.samsung.shealth.tracker.pedometer_day_summary.<ts>.csv (columns step_count, … day_time)
 * Line 1 is a metadata line ("com.samsung.shealth.step_daily_trend,6156001,6"); line 2 is the header.
 * `day_time` marks the day as epoch milliseconds at 00:00 UTC (newer exports may use an ISO date).
 * `source_type` −2 is Samsung's combined total across devices; when present it wins, otherwise the
 * highest single-device count is used so phone + watch are never double-counted.
 */
export interface DaySteps {
  date: string;
  count: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function toDate(v: string): string | null {
  const t = v.trim();
  if (/^\d{11,14}$/.test(t)) return new Date(Number(t)).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

export function parseSamsungSteps(text: string): DaySteps[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('This file is empty.');
  let headerIdx = lines[0].startsWith('com.samsung') ? 1 : 0;
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.trim().split('.').pop()!.toLowerCase());
  const iDay = header.indexOf('day_time');
  const iCount = header.indexOf('count') >= 0 ? header.indexOf('count') : header.indexOf('step_count');
  const iSource = header.indexOf('source_type');
  if (iDay < 0 || iCount < 0) {
    throw new Error('Not a Samsung Health step file. Choose "com.samsung.shealth.step_daily_trend…csv" from your export.');
  }
  headerIdx++;
  const combined = new Map<string, number>();
  const best = new Map<string, number>();
  for (const line of lines.slice(headerIdx)) {
    const cols = splitCsvLine(line);
    const date = toDate(cols[iDay] ?? '');
    const count = Number(cols[iCount]);
    if (!date || !Number.isFinite(count) || count < 0) continue;
    if (iSource >= 0 && cols[iSource]?.trim() === '-2') combined.set(date, Math.max(combined.get(date) ?? 0, count));
    else best.set(date, Math.max(best.get(date) ?? 0, count));
  }
  const dates = new Set([...combined.keys(), ...best.keys()]);
  return [...dates]
    .sort()
    .map((date) => ({ date, count: Math.round(combined.get(date) ?? best.get(date)!) }));
}
