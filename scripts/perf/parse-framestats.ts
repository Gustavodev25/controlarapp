import fs from 'node:fs';
import path from 'node:path';

type FrameStatsSummary = {
  totalFrames: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  droppedPct: number;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function parseDurationsMs(input: string): number[] {
  const lines = input.split(/\r?\n/);
  const values: number[] = [];

  for (const line of lines) {
    if (!line.includes(',')) continue;
    const cols = line.split(',');
    if (cols.length < 14) continue;

    const intendedVsync = Number(cols[1]);
    const frameCompleted = Number(cols[13]);
    if (!Number.isFinite(intendedVsync) || !Number.isFinite(frameCompleted) || intendedVsync <= 0 || frameCompleted <= 0) {
      continue;
    }

    const durationNs = frameCompleted - intendedVsync;
    if (durationNs <= 0) continue;

    values.push(durationNs / 1_000_000);
  }

  return values;
}

function summarize(values: number[]): FrameStatsSummary {
  const p50 = percentile(values, 50);
  const p95 = percentile(values, 95);
  const p99 = percentile(values, 99);
  const dropped = values.filter((ms) => ms > 16.67).length;

  return {
    totalFrames: values.length,
    p50Ms: Number(p50.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    p99Ms: Number(p99.toFixed(2)),
    droppedPct: Number(((dropped / Math.max(1, values.length)) * 100).toFixed(2)),
  };
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/perf/parse-framestats.ts <gfxinfo-file>');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), inputPath);
const content = fs.readFileSync(absolutePath, 'utf8');
const durations = parseDurationsMs(content);
const report = summarize(durations);

console.log(JSON.stringify(report, null, 2));
