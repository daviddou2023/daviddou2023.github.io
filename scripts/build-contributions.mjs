import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { articleDate, articlePage, articleTitle } from './article-utils.mjs';
const root = process.cwd(); const contentDir = join(root, 'content');
const files = existsSync(contentDir) ? readdirSync(contentDir).filter((file) => file.endsWith('.md')) : []; const years = {};
const normalizeContent = (source) => source
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')
  .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
  .split(/\r?\n/)
  .map((line) => line.trim().replace(/\s+/g, ' '))
  .filter(Boolean)
  .join('\n');
const gitVersions = (file) => {
  try {
    const history = execFileSync('git', ['log', '--reverse', '--follow', '--format=%H%x09%ad', '--date=format:%Y-%m-%d', '--', join('content', file)], { encoding: 'utf8' }).trim();
    if (!history) return [];
    const versions = [];
    for (const line of history.split(/\r?\n/)) {
      const [hash, date] = line.split('\t');
      try {
        const source = execFileSync('git', ['show', `${hash}:${join('content', file).replaceAll('\\', '/')}`], { encoding: 'utf8' });
        const content = normalizeContent(source);
        if (!versions.length || versions.at(-1).content !== content) versions.push({ date, content });
      } catch { /* The path may have changed during a rename. */ }
    }
    return versions.map(({ date }) => date);
  } catch { return []; }
};
const isDirty = (file) => { for (const args of [['diff', '--quiet', '--'], ['diff', '--cached', '--quiet', '--']]) { try { execFileSync('git', [...args, join('content', file)]); } catch (error) { if (error.status === 1) return true; } } return false; };
const hasSemanticWorkingChange = (file, source) => {
  try {
    const committed = execFileSync('git', ['show', `HEAD:${join('content', file).replaceAll('\\', '/')}`], { encoding: 'utf8' });
    return normalizeContent(source) !== normalizeContent(committed);
  } catch { return false; }
};
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
for (const file of files) { const source = readFileSync(join(contentDir, file), 'utf8'); const title = articleTitle(source, file); const excerpt = (source.split(/\r?\n/).find((line) => line.trim() && !line.startsWith('#') && !line.startsWith('![') && !/^https?:\/\//i.test(line.trim())) || '').trim(); const frontmatterDate = (source.match(/^date:\s*(\d{4}-\d{2}-\d{2})$/m) || [])[1]; const stat = statSync(join(contentDir, file)); const dates = new Set(gitVersions(file)); if (isDirty(file) && hasSemanticWorkingChange(file, source)) dates.add(localDate(stat.mtime)); const fallbackDate = articleDate(file) || localDate(stat.mtime); const contributionDates = frontmatterDate ? [frontmatterDate] : (dates.size ? [...dates] : [fallbackDate]); const url = articlePage(file); for (const date of contributionDates) { const year = date.slice(0, 4); years[year] ||= { days: {}, entries: [] }; years[year].days[date] = (years[year].days[date] || 0) + 1; years[year].entries.push({ date, title, excerpt, url }); } }
for (const value of Object.values(years)) value.entries.sort((a, b) => b.date.localeCompare(a.date)); mkdirSync(join(root, 'data'), { recursive: true }); writeFileSync(join(root, 'data', 'contributions.json'), JSON.stringify({ generatedAt: new Date().toISOString(), years }, null, 2));
