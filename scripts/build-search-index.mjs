import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { articlePage, articleTitle } from './article-utils.mjs';

const root = process.cwd();
const readMarkdownFiles = (directory) => existsSync(directory)
  ? readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md')).map((entry) => entry.name).sort()
  : [];
const toSearchText = (markdown) => markdown
  .replace(/^---\s*\n[\s\S]*?\n---\s*\n/m, '')
  .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
  .replace(/[|*_`~]/g, ' ')
  .replace(/\\([\\`*_{}\[\]()#+.!|>-])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const entries = [];
for (const file of readMarkdownFiles(join(root, 'content'))) {
  const markdown = readFileSync(join(root, 'content', file), 'utf8');
  const title = articleTitle(markdown, file);
  entries.push({ title, type: 'article', url: articlePage(file), source: `content/${file}`, text: toSearchText(markdown) });
}
for (const file of readMarkdownFiles(join(root, 'notes-content'))) {
  const markdown = readFileSync(join(root, 'notes-content', file), 'utf8');
  const title = articleTitle(markdown, file);
  entries.push({ title, type: 'note', url: `notes.html?note=${encodeURIComponent(file)}`, source: `notes-content/${file}`, text: toSearchText(markdown) });
}

mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data', 'search-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2));
console.log(`已生成搜索索引：${entries.length} 篇文章与随笔。`);
