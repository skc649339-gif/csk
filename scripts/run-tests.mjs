import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const upstream = ['pan-integrity', 'dst-cn', 'clock-adjust', 'sizhu-lichun-boundary', 'hongluan-tianxi', 'famous-hour-consistency', 'iztro-time-index-boundary', 'solar-date-exists', 'gender-validation', 'natal-dual-sihua-same-palace', 'neutral-naming', 'leap-policy-validation', 'form-true-solar-day', 'birthform-birthinfo-consistency', 'heming-refresh', 'heming-stream', 'patterns-sihua-bonus'].map(name => `${name}.test.ts`);
const local = ['records.test.ts', 'calendar-input.test.ts', 'navigation.test.tsx'];
const kind = process.argv[2] || 'upstream';
if (!['upstream', 'local'].includes(kind)) throw new Error('Choose upstream or local');
const results = [];
for (const file of kind === 'local' ? local : upstream) {
  const start = Date.now();
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', `scripts/regression/${file}`], {
    encoding: 'utf8', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, maxBuffer: 10 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}${result.error || ''}`;
  console.log(output.trim());
  results.push({ file, passed: result.status === 0, exitCode: result.status, milliseconds: Date.now() - start, output });
}
mkdirSync('test-results', { recursive: true });
writeFileSync(`test-results/${kind}.json`, JSON.stringify({ date: new Date().toISOString(), runtime: process.version, results }, null, 2));
console.log(`${kind}: ${results.filter(r => r.passed).length}/${results.length} suites passed`);
if (results.some(r => !r.passed)) process.exitCode = 1;
