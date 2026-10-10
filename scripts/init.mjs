// Turns the skeleton into your extension: renames "Tab Counter" everywhere,
// sets the description and repo URL, resets the version, and removes itself.
//
//   node scripts/init.mjs "My Extension" "What it does in one line" hacktoolkit/my-extension
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [,, name, description, repo] = process.argv;
if (!name || !description || !repo) {
    console.error('usage: node scripts/init.mjs "Name" "One-line description" owner/repo');
    process.exit(2);
}
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const replacements = [
    ['Tab Counter', name],
    ['tab-counter', slug],
    ['tab_counter', slug.replace(/-/g, '_')],
    ['Counts your tabs and closes the blank ones. A Hacktoolkit skeleton extension.', description],
    ['hacktoolkit/htk-chrome-extension-skeleton', repo]
];
function walk(dir, out = []) {
    for (const f of readdirSync(dir)) {
        if (['node_modules', '.git', 'img'].includes(f)) continue;
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(js|mjs|json|md|html|css|yml)$|^Makefile$|^FILES$/.test(f)) out.push(p);
    }
    return out;
}
let changed = 0;
for (const file of walk('.')) {
    const before = readFileSync(file, 'utf8');
    let after = before;
    for (const [from, to] of replacements) after = after.split(from).join(to);
    if (after !== before) { writeFileSync(file, after); changed++; }
}
// drop the template-only parts of the README
const readme = readFileSync('README.md', 'utf8').replace(/<!-- skeleton:start -->[\s\S]*?<!-- skeleton:end -->\n?/g, '').replace(/\n{3,}/g, '\n\n');
writeFileSync('README.md', readme);
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = '0.1.0';
writeFileSync('manifest.json', JSON.stringify(manifest, null, 4) + '\n');
rmSync('scripts/init.mjs');
console.log(`Renamed to "${name}" (${slug}) in ${changed} files. Next: replace img/icon*.png, edit src/lib/actions.js, run make test && make e2e.`);
