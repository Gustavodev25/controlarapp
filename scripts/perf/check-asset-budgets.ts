import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');

const PNG_BUDGET_KB = 700;
const GLB_BUDGET_KB = 2000;
const MAX_TRIANGLES_REFERENCE = 120_000;
const MAX_TRIANGLES_MID = 72_000;
const MAX_TRIANGLES_ENTRY = 42_000;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function kb(bytes: number): number {
  return Number((bytes / 1024).toFixed(2));
}

const files = walk(ASSETS_DIR);
const pngs = files.filter((file) => file.toLowerCase().endsWith('.png'));
const glbLike = files.filter((file) => /\.(glb|gltf|obj|fbx)$/i.test(file));

const pngOverBudget = pngs
  .map((file) => ({ file, sizeKb: kb(fs.statSync(file).size) }))
  .filter((item) => item.sizeKb > PNG_BUDGET_KB);

const glbOverBudget = glbLike
  .map((file) => ({ file, sizeKb: kb(fs.statSync(file).size) }))
  .filter((item) => item.sizeKb > GLB_BUDGET_KB);

const report = {
  pngCount: pngs.length,
  glbLikeCount: glbLike.length,
  pngOverBudget,
  glbOverBudget,
  lodTriangleBudgets: {
    reference: MAX_TRIANGLES_REFERENCE,
    mid_3gb_quad: MAX_TRIANGLES_MID,
    entry_2gb_quad: MAX_TRIANGLES_ENTRY,
  },
};

console.log(JSON.stringify(report, null, 2));

if (pngOverBudget.length > 0 || glbOverBudget.length > 0) {
  process.exit(2);
}
