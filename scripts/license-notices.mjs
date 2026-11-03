/** Preserve project copyright + reproducible dependency notices in static output. */
import { copyFile, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_PACKAGES = ['next', 'react', 'react-dom', 'iztro', 'lunar-javascript', 'framer-motion', 'html2canvas', 'clsx'];
const legalFilename = name => /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name);

async function packageDirectory(name, from = root) {
  let cursor = await realpath(from);
  for (;;) {
    const candidate = path.join(cursor, 'node_modules', name);
    try {
      await readFile(path.join(candidate, 'package.json'));
      return await realpath(candidate);
    } catch {}
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

async function compiledLegalFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...await compiledLegalFiles(path.join(directory, entry.name), relative + '/'));
    } else if (entry.isFile() && legalFilename(entry.name)) {
      files.push({ relative, text: await readFile(path.join(directory, entry.name), 'utf8') });
    }
  }
  return files;
}

export async function generateLicenseNotices(output = path.join(root, 'out')) {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const inventory = Object.entries(lock.packages || {}).filter(([location]) => location).map(([location, entry]) => ({
    location,
    name: entry.name || location.split('node_modules/').at(-1),
    version: entry.version || 'NOT DECLARED',
    license: typeof entry.license === 'string' ? entry.license : 'NOT DECLARED IN PACKAGE-LOCK',
    kind: entry.dev ? 'development' : entry.optional ? 'optional' : 'declared dependency',
  })).sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en') || a.location.localeCompare(b.location, 'en'));
  if (!inventory.length) throw new Error('Cannot create notices: package-lock.json has no package inventory.');

  const sections = [
    '紫微斗数 iPhone 自用版 — THIRD-PARTY NOTICES',
    'Generated from package-lock.json and installed dependency license files. No external service is contacted.',
    'The inventory is a superset including build/server/optional dependencies; it does not claim all packages execute in the client bundle.',
    'SPDX expressions below reproduce the license metadata declared in package-lock.json. Full texts and copyright notices follow where supplied by the installed packages.',
    'Project source: https://github.com/Renhuai123/ziwei-doushu — original MIT license is preserved separately in LICENSE.txt.',
    'Classical texts and restricted source materials have separate terms; see source docs/LICENSE_AUDIT.md and docs/tianji-ziwei/LICENSE.md. No Release interpretation dataset was downloaded or bundled.',
    '',
    `PACKAGE-LOCK INVENTORY — ${inventory.length} package locations`,
    'Package\tVersion\tDeclared SPDX / license\tKind\tLockfile location',
    ...inventory.map(entry => [entry.name, entry.version, entry.license, entry.kind, entry.location].join('\t')),
    '',
    'FULL LICENSE AND NOTICE TEXTS — main client packages and their installed dependencies',
  ];

  const seen = new Set();
  let fullTextFiles = 0;
  let nextDirectory;
  async function appendPackage(name, from, required = false) {
    const directory = await packageDirectory(name, from);
    if (!directory) {
      if (required) throw new Error(`Required client dependency is not installed: ${name}`);
      return;
    }
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (pkg.name === 'next') nextDirectory = directory;
    const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && legalFilename(entry.name)).map(entry => entry.name).sort();
    if (required && !files.length) throw new Error(`Required client license file is missing: ${key}`);
    for (const filename of files) {
      sections.push('', '='.repeat(78), `${key} — ${filename}`, '='.repeat(78), await readFile(path.join(directory, filename), 'utf8'));
      fullTextFiles++;
    }
    for (const dependency of Object.keys(pkg.dependencies || {}).sort()) await appendPackage(dependency, directory);
  }
  for (const name of CLIENT_PACKAGES) await appendPackage(name, root, true);
  // Next ships additional compiled dependencies whose notices are not individual
  // package-lock entries. Preserve their supplied license files as a superset.
  if (nextDirectory) {
    const compiled = await compiledLegalFiles(path.join(nextDirectory, 'dist/compiled'));
    for (const file of compiled.sort((a, b) => a.relative.localeCompare(b.relative, 'en'))) {
      sections.push('', '='.repeat(78), `next bundled dependency — dist/compiled/${file.relative}`, '='.repeat(78), file.text);
      fullTextFiles++;
    }
  }
  await copyFile(path.join(root, 'LICENSE'), path.join(output, 'LICENSE.txt'));
  await writeFile(path.join(output, 'THIRD_PARTY_NOTICES.txt'), sections.join('\n') + '\n');
  console.log(`License notices: ${inventory.length} lockfile packages; ${fullTextFiles} full license/notice files preserved.`);
  return { packages: inventory.length, fullTextFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateLicenseNotices();
