import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(readFileSync(path.join(root, 'docs/ENGINE_BASELINE.json'), 'utf8'));
const results = baseline.files.map(file => {
  const text = readFileSync(path.join(root, file.path), 'utf8').replace(/\r\n/g, '\n');
  const sha256 = createHash('sha256').update(text).digest('hex');
  return { ...file, sha256, unchanged: sha256 === file.sha256 };
});
mkdirSync(path.join(root, 'test-results'), { recursive: true });
writeFileSync(path.join(root, 'test-results/engine-integrity.json'), JSON.stringify({ baseline: baseline.commit, date: new Date().toISOString(), results }, null, 2));
for (const file of results.filter(file => !file.unchanged)) console.error('Changed engine source:', file.path);
console.log(`Engine source preservation: ${results.filter(file => file.unchanged).length}/${results.length} match upstream ${baseline.commit}`);
if (results.some(file => !file.unchanged)) process.exitCode = 1;
