import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const patch = JSON.parse(readFileSync(path.join(root, 'patches/lunar-lite-0.2.8.json'), 'utf8'));
const hash = text => createHash('sha256').update(text).digest('hex');

/** Exact-version, exact-byte patch. Unknown sources fail before any write. */
export function patchedConverter(source, version) {
  if (version !== patch.version) throw new Error(`R4-01 patch requires lunar-lite ${patch.version}; received ${version}`);
  const digest = hash(source);
  if (digest === patch.afterSha256) return source;
  if (digest !== patch.beforeSha256) throw new Error('R4-01 patch refused: lunar-lite converter SHA-256 does not match');
  if (source.split(patch.before).length !== 2) throw new Error('R4-01 patch refused: converter block must occur exactly once');
  const result = source.replace(patch.before, patch.after);
  if (hash(result) !== patch.afterSha256) throw new Error('R4-01 patch refused: unexpected output SHA-256');
  return result;
}

export function applyLunarLiteFix() {
  const require = createRequire(path.join(root, 'package.json'));
  const file = require.resolve('lunar-lite/lib/convertor.js');
  const consumer = createRequire(require.resolve('iztro/package.json'));
  if (consumer.resolve('lunar-lite/lib/convertor.js') !== file) throw new Error('R4-01 patch refused: iztro resolves a different lunar-lite copy');
  const version = JSON.parse(readFileSync(require.resolve('lunar-lite/package.json'), 'utf8')).version;
  const source = readFileSync(file, 'utf8'), result = patchedConverter(source, version);
  if (result !== source) writeFileSync(file, result, 'utf8');
  return { version, sha256: hash(result), changed: result !== source };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('R4-01 lunar-lite installation fix:', JSON.stringify(applyLunarLiteFix()));
}
