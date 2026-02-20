import fs from 'node:fs';
import path from 'node:path';

type PerfRow = {
  uiFps: number;
  jsFps: number;
  p95FrameMs: number;
  droppedFramesPct: number;
  jsLagP95Ms: number;
};

function readRows(filePath: string): PerfRow[] {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const header = lines.shift();
  if (!header) return [];

  const columns = header.split(',');
  const colIndex = (name: string) => columns.indexOf(name);

  const uiIdx = colIndex('uiFps');
  const jsIdx = colIndex('jsFps');
  const p95Idx = colIndex('p95FrameMs');
  const dropIdx = colIndex('droppedFramesPct');
  const lagIdx = colIndex('jsLagP95Ms');

  return lines.map((line) => {
    const parts = line.split(',');
    return {
      uiFps: Number(parts[uiIdx]),
      jsFps: Number(parts[jsIdx]),
      p95FrameMs: Number(parts[p95Idx]),
      droppedFramesPct: Number(parts[dropIdx]),
      jsLagP95Ms: Number(parts[lagIdx]),
    };
  });
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/perf/summarize.ts <csv-file>');
  process.exit(1);
}

const csvPath = path.resolve(process.cwd(), input);
const rows = readRows(csvPath);

if (rows.length === 0) {
  console.error('No rows found.');
  process.exit(1);
}

const summary = {
  samples: rows.length,
  uiFpsAvg: Number(avg(rows.map((r) => r.uiFps)).toFixed(2)),
  jsFpsAvg: Number(avg(rows.map((r) => r.jsFps)).toFixed(2)),
  frameP95: Number(p95(rows.map((r) => r.p95FrameMs)).toFixed(2)),
  droppedAvgPct: Number(avg(rows.map((r) => r.droppedFramesPct)).toFixed(2)),
  jsLagP95: Number(p95(rows.map((r) => r.jsLagP95Ms)).toFixed(2)),
};

console.log(JSON.stringify(summary, null, 2));
