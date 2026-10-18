import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { articleDate, articlePage, articleSlug, articleTitle } from './scripts/article-utils.mjs';

const root = process.cwd();
const contentDir = join(root, 'content');
const imageRoot = join(root, 'assets', 'images');
const manifestPath = join(root, 'data', 'imported-articles.json');
const markdownFiles = readdirSync(contentDir).filter((file) => file.toLowerCase().endsWith('.md')).sort();
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const inlineText = (value) => value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_#>]/g, '').trim();
const dateLabel = (date) => date || '日期待补充';
const localizeImages = async (file) => {
  const path = join(contentDir, file);
  let markdown = readFileSync(path, 'utf8');
  const directory = join(imageRoot, articleSlug(file));
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...markdown.matchAll(imagePattern)];
  for (const [index, match] of matches.entries()) {
    const source = match[2];
    if (!/^https?:\/\//i.test(source)) continue;
    mkdirSync(directory, { recursive: true });
    const response = await fetch(source);
    if (!response.ok) throw new Error(`下载图片失败 (${response.status}): ${file}`);
    const type = response.headers.get('content-type') || '';
    const remoteExtension = extname(new URL(source).pathname).toLowerCase();
    const extension = /\.(png|jpe?g|gif|webp|svg)$/.test(remoteExtension) ? remoteExtension : type.includes('jpeg') ? '.jpg' : type.includes('gif') ? '.gif' : type.includes('webp') ? '.webp' : type.includes('svg') ? '.svg' : '.png';
    const imageName = `image-${String(index + 1).padStart(2, '0')}${extension}`;
    writeFileSync(join(directory, imageName), Buffer.from(await response.arrayBuffer()));
    const replacement = `![${match[1] || '文章配图'}](assets/images/${articleSlug(file)}/${imageName})`;
    markdown = markdown.replace(match[0], replacement);
  }
  markdown = markdown.replace(/\\([\\`*_{}\[\]()#+.!|>-])/g, '$1');
  if (markdown !== readFileSync(path, 'utf8')) writeFileSync(path, markdown, 'utf8');
  return markdown;
};
const makePage = (file, title, date) => {
  const encodedPath = `content/${encodeURIComponent(file)}`;
  const pageTitle = escapeHtml(title);
  const prettyDate = escapeHtml(dateLabel(date));
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="../"><meta name="description" content="${pageTitle}"><title>${pageTitle} · 技术博客 · 嘻嘻仙人</title><link rel="stylesheet" href="styles.css"></head>
<body><header class="site-header"><a class="brand" href="index.html">嘻嘻仙人</a><nav><a href="index.html">首页</a><a class="active" href="blog.html">技术博客</a><a href="notes.html">随笔</a></nav><a class="header-link" href="https://github.com/" target="_blank" rel="noreferrer">GitHub ↗</a></header><main><article class="article-page container"><div class="article-top"><a class="back-link" href="blog.html">← 技术博客</a><span>${prettyDate}</span></div><p class="eyebrow">TECHNICAL BLOG</p><h1>${pageTitle}</h1><div class="article-rule"></div><div id="article-content" class="prose"><p class="loading">正在加载文章内容…</p></div></article></main><footer class="site-footer"><div class="container footer-inner"><span>© 2026 嘻嘻仙人</span><a href="blog.html">返回技术博客 ↑</a></div></footer><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script><script>fetch(${JSON.stringify(encodedPath)}).then(r=>r.text()).then(md=>{document.getElementById('article-content').innerHTML=marked.parse(md.replace(/^#.*\\n/,''));}).catch(()=>{document.getElementById('article-content').textContent='文章加载失败，请检查 Markdown 文件是否已发布。';});</script></body></html>
`;
};

const generatedPages = markdownFiles.filter((file) => existsSync(join(root, articlePage(file))));
const oldManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const knownHashes = oldManifest.articles || Object.fromEntries((oldManifest.files || generatedPages).map((file) => [file, createHash('sha256').update(readFileSync(join(contentDir, file))).digest('hex')]));
for (const file of generatedPages) knownHashes[file] ||= createHash('sha256').update(readFileSync(join(contentDir, file))).digest('hex');
const articles = [];
const importedNow = [];
const updatedNow = [];
const currentHashes = {};
for (const file of markdownFiles) {
  const source = readFileSync(join(contentDir, file), 'utf8');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const isNew = !knownHashes[file];
  const isChanged = !isNew && knownHashes[file] !== sourceHash;
  const markdown = isNew || isChanged ? await localizeImages(file) : source;
  currentHashes[file] = createHash('sha256').update(markdown).digest('hex');
  const title = articleTitle(markdown, file);
  const date = articleDate(file);
  const excerpt = inlineText(markdown.split(/\r?\n/).find((line) => line.trim() && !line.startsWith('#') && !line.startsWith('![') && !/^https?:\/\//i.test(line.trim())) || '');
  const page = articlePage(file);
  const pageNeedsMigration = existsSync(join(root, page)) && !readFileSync(join(root, page), 'utf8').includes('<base href="../">');
  if (isNew || isChanged || pageNeedsMigration) {
    writeFileSync(join(root, page), makePage(file, title, date), 'utf8');
    if (isNew) importedNow.push(file);
    else if (isChanged) updatedNow.push(file);
  }
  articles.push({ file, title, date, excerpt, page });
}

const rows = articles.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title, 'zh-CN')).map((article, index) => `<a class="article-row" href="${escapeHtml(article.page)}"><div class="article-index">${String(articles.length - index).padStart(2, '0')}</div><div class="article-content"><p class="article-kicker">TECHNICAL BLOG · ${escapeHtml(dateLabel(article.date))}</p><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.excerpt)}</p></div><span class="arrow">↗</span></a>`).join('\n');
const blogPath = join(root, 'blog.html');
let blog = readFileSync(blogPath, 'utf8');
const sectionPattern = /(<section class="container article-list">)[\s\S]*?(<\/section>)/;
if (!sectionPattern.test(blog)) throw new Error('blog.html 中找不到 article-list 区块');
blog = blog.replace(sectionPattern, `$1\n${rows}\n$2`);
writeFileSync(blogPath, blog, 'utf8');
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(manifestPath, JSON.stringify({ articles: currentHashes }, null, 2), 'utf8');
execFileSync(process.execPath, [join(root, 'scripts', 'build-contributions.mjs')], { stdio: 'inherit' });

console.log(`新处理 ${importedNow.length} 篇 Markdown 文章；已有文章 ${articles.length - importedNow.length} 篇仅用于生成列表。`);
for (const file of importedNow) {
  const article = articles.find((entry) => entry.file === file);
  console.log(`- ${article.title} -> ${article.page}`);
}
for (const file of updatedNow) {
  const article = articles.find((entry) => entry.file === file);
  console.log(`- 更新 ${article.title} -> ${article.page}`);
}
