import { MovementType } from '@prisma/client';
import type { ChartPeriod } from './dashboard.dto';

export const ENTRY_TYPES: MovementType[] = [
  'ENTRADA_COMPRA',
  'ENTRADA_MANUAL',
  'AJUSTE_ENTRADA',
  'DEVOLUCAO',
];

type GroupBy = 'hour' | 'day' | 'month';

interface Bucket {
  key: string;
  label: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date) {
  return d.toISOString().split('T')[0];
}

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function getChartPeriodConfig(period: ChartPeriod): {
  start: Date;
  groupBy: GroupBy;
  buckets: Bucket[];
} {
  const now = new Date();

  switch (period) {
    case 'day': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const buckets: Bucket[] = [];
      for (let h = 0; h < 24; h++) {
        buckets.push({ key: `h${h}`, label: `${pad(h)}:00` });
      }
      return { start, groupBy: 'hour', buckets };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const buckets: Bucket[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = toDateKey(d);
        buckets.push({ key, label: key.slice(5) });
      }
      return { start, groupBy: 'day', buckets };
    }
    case 'month': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const buckets: Bucket[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = toDateKey(d);
        buckets.push({ key, label: key.slice(5) });
      }
      return { start, groupBy: 'day', buckets };
    }
    case 'semester': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const buckets: Bucket[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const key = toMonthKey(d);
        buckets.push({ key, label: `${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` });
      }
      return { start, groupBy: 'month', buckets };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const buckets: Bucket[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const key = toMonthKey(d);
        buckets.push({ key, label: `${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` });
      }
      return { start, groupBy: 'month', buckets };
    }
  }
}

export function movementBucketKey(date: Date, groupBy: GroupBy): string {
  if (groupBy === 'hour') return `h${date.getHours()}`;
  if (groupBy === 'day') return toDateKey(date);
  return toMonthKey(date);
}

export function buildEntriesExitsChart(
  movements: { type: MovementType; quantity: number; movementDate: Date }[],
  period: ChartPeriod
) {
  const { start, groupBy, buckets } = getChartPeriodConfig(period);

  const entries = movements.filter((m) => ENTRY_TYPES.includes(m.type));
  const exits = movements.filter(
    (m) => !ENTRY_TYPES.includes(m.type) && m.type !== 'TRANSFERENCIA'
  );

  const inRange = (d: Date) => d >= start && d <= new Date();

  const sumByBucket = (list: typeof movements) => {
    const map = new Map<string, number>();
    for (const b of buckets) map.set(b.key, 0);
    for (const m of list) {
      if (!inRange(m.movementDate)) continue;
      const key = movementBucketKey(m.movementDate, groupBy);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + m.quantity);
    }
    return map;
  };

  const entryMap = sumByBucket(entries);
  const exitMap = sumByBucket(exits);

  return buckets.map((b) => ({
    date: b.label,
    entries: entryMap.get(b.key) ?? 0,
    exits: exitMap.get(b.key) ?? 0,
  }));
}
