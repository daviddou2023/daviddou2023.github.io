const searchBox = document.createElement('div');
searchBox.className = 'global-search';
searchBox.innerHTML = '<input type="search" aria-label="搜索文章和随笔" placeholder="搜索文章和随笔" autocomplete="off"><div class="search-results" role="listbox" hidden></div>';
document.querySelector('.site-header')?.append(searchBox);
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="search.css">');

const input = searchBox.querySelector('input');
const results = searchBox.querySelector('.search-results');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let entries = [];

const snippetFor = (text, query) => {
  const offset = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, offset - 64);
  const end = Math.min(text.length, offset + query.length + 100);
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};
const markText = (text, query) => {
  const escaped = escapeHtml(text);
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQuery})`, 'ig'), '<mark>$1</mark>');
};
const renderResults = () => {
  const query = input.value.trim();
  results.replaceChildren();
  if (query.length < 2) { results.hidden = true; return; }
  const needle = query.toLocaleLowerCase();
  const matches = entries.map((entry) => {
    const titleMatch = entry.title.toLocaleLowerCase().includes(needle);
    const bodyMatch = entry.text.toLocaleLowerCase().includes(needle);
    return titleMatch || bodyMatch ? { entry, titleMatch, bodyMatch } : null;
  }).filter(Boolean).slice(0, 8);
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = '没有找到匹配内容';
    results.append(empty);
  } else {
    for (const { entry, titleMatch, bodyMatch } of matches) {
      const link = document.createElement('a');
      const target = new URL(entry.url, document.baseURI);
      target.searchParams.set('q', query);
      link.className = 'search-result';
      link.href = `${target.pathname}${target.search}${target.hash}`;
      const snippet = titleMatch && !bodyMatch ? entry.text.slice(0, 140) : snippetFor(entry.text, query);
      link.innerHTML = `<span class="search-result-title"><span>${markText(entry.title, query)}</span><span class="search-result-type">${entry.type === 'note' ? '随笔' : '技术博客'}</span></span><span class="search-result-snippet">${markText(snippet, query)}</span>`;
      results.append(link);
    }
  }
  results.hidden = false;
};

input.addEventListener('input', renderResults);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') results.hidden = true;
  if (event.key === 'Enter' && !results.hidden) results.querySelector('.search-result')?.click();
  if (event.key === 'ArrowDown' && !results.hidden) { event.preventDefault(); results.querySelector('.search-result')?.focus(); }
});
document.addEventListener('click', (event) => { if (!searchBox.contains(event.target)) results.hidden = true; });
fetch(`data/search-index.json?v=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then((index) => { entries = index.entries || []; }).catch(() => { entries = []; });

const highlightFirstMatch = (container, query) => {
  if (!container || !query) return false;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest('script,style,button,mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const needle = query.toLocaleLowerCase();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const offset = node.nodeValue.toLocaleLowerCase().indexOf(needle);
    if (offset < 0) continue;
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + query.length);
    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  return false;
};

const highlightFromUrl = () => {
  const query = new URLSearchParams(location.search).get('q');
  if (!query || document.querySelector('.search-highlight')) return;
  const content = document.querySelector('#article-content, #note-content');
  if (content?.querySelector('.loading')) return;
  if (!highlightFirstMatch(content, query)) highlightFirstMatch(document.querySelector('.article-page > h1, .notes-reader h1'), query);
};
window.highlightSearchTerm = highlightFromUrl;
document.addEventListener('article-content-ready', highlightFromUrl);
const articleContent = document.querySelector('#article-content');
if (articleContent) new MutationObserver(() => highlightFromUrl()).observe(articleContent, { childList: true, subtree: true });
if (document.querySelector('#note-content')) new MutationObserver(() => highlightFromUrl()).observe(document.querySelector('#note-content'), { childList: true, subtree: true });
highlightFromUrl();
if (new URLSearchParams(location.search).has('note')) {
  const file = new URLSearchParams(location.search).get('note');
  let section = document.querySelector('.notes-reader');
  if (!section) {
    section = document.createElement('section');
    section.className = 'container notes-reader article-page';
    section.innerHTML = '<div class="article-top"><a href="notes.html">返回随笔</a><span>随笔</span></div><h1></h1><div id="note-content" class="prose"></div>';
    document.querySelector('.empty-notes')?.before(section);
  }
  if (section) {
    document.querySelector('.empty-notes')?.setAttribute('hidden', '');
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    markedScript.onload = () => fetch(`notes-content/${encodeURIComponent(file)}`).then((response) => response.ok ? response.text() : Promise.reject()).then((markdown) => {
      const title = markdown.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.md$/i, '');
      section.querySelector('h1').textContent = title;
      section.querySelector('#note-content').innerHTML = marked.parse(markdown.replace(/^#.*\n/, ''));
      document.dispatchEvent(new Event('article-content-ready'));
    }).catch(() => { section.querySelector('#note-content').textContent = '随笔加载失败，请确认 notes-content 目录中存在该文件。'; });
    document.head.append(markedScript);
  }
}
