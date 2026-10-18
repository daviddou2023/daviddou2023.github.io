import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export const articleSlug = (file) => createHash('sha256').update(file).digest('hex').slice(0, 10);
export const articlePage = (file) => file === 'kv-cache.md' ? 'articals/article.html' : `articals/article-${articleSlug(file)}.html`;
export const articleTitle = (source, file) => (source.match(/^#\s+(.+)$/m) || [])[1] || basename(file, '.md');
export const articleDate = (file) => {
  const match = basename(file).match(/[（(](\d{6}|\d{8})[）)](?=\.md$)/);
  if (!match) return null;
  const value = match[1];
  return value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
};
