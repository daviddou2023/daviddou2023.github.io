const applyTheme = (theme) => document.documentElement.dataset.theme = theme;
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="theme.css">');
const savedTheme = localStorage.getItem('site-theme') || 'light';
applyTheme(savedTheme);
const header = document.querySelector('.site-header');
if (header && !header.querySelector('.theme-toggle')) {
  const toggle = document.createElement('button');
  toggle.className = 'theme-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '切换深色主题');
  toggle.innerHTML = '<span aria-hidden="true">◐</span><span class="theme-toggle-label">深色</span>';
  toggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    localStorage.setItem('site-theme', theme);
    toggle.setAttribute('aria-label', theme === 'dark' ? '切换浅色主题' : '切换深色主题');
    toggle.querySelector('.theme-toggle-label').textContent = theme === 'dark' ? '浅色' : '深色';
  });
  header.append(toggle);
  toggle.querySelector('.theme-toggle-label').textContent = savedTheme === 'dark' ? '浅色' : '深色';
  toggle.setAttribute('aria-label', savedTheme === 'dark' ? '切换浅色主题' : '切换深色主题');
}
const enhanceCodeBlocks = () => {
  if (window.hljs) document.querySelectorAll('pre code').forEach((block) => window.hljs.highlightElement(block));
  document.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.copy-code')) return;
    const button = document.createElement('button');
    button.className = 'copy-code';
    button.type = 'button';
    button.textContent = '复制';
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(pre.querySelector('code')?.innerText || '');
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = '复制'; }, 1400);
    });
    pre.append(button);
  });
};
window.enhanceCodeBlocks = enhanceCodeBlocks;
new MutationObserver(() => enhanceCodeBlocks()).observe(document.body, { childList: true, subtree: true });
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="contributions.css"><link rel="stylesheet" href="contributions-override.css">');

const heatmap = document.querySelector('.heatmap');
if (heatmap) {
  const fallback = { years: { 2026: { days: { '2026-10-13': 1 }, entries: [{ date: '2026-10-13', title: 'KV Cache：大语言模型推理中的关键记忆机制', url: 'article.html' }] } } };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const level = (count, maximum) => count === 0 ? 0 : Math.min(4, Math.ceil((count / Math.max(maximum, 1)) * 4));
  const section = heatmap.closest('.contribution-section');
  const originalWrap = heatmap.parentElement;
  const layout = document.createElement('div');
  layout.className = 'contribution-layout';
  originalWrap.replaceWith(layout);
  layout.appendChild(originalWrap);
  const main = layout.firstElementChild;
  const toolbar = document.createElement('div');
  toolbar.className = 'contribution-toolbar';
  toolbar.innerHTML = '<span class="contribution-count" id="contribution-count"></span><div class="contribution-legend"><span>少</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>多</span></div>';
  main.prepend(toolbar);
  const history = document.createElement('div');
  history.className = 'contribution-history';
  history.innerHTML = '<h3>文章提交记录</h3><div id="contribution-history-list"></div>';
  layout.appendChild(history);
  const yearList = document.createElement('aside');
  yearList.className = 'year-list';
  yearList.setAttribute('aria-label', '历史年份');
  layout.appendChild(yearList);
  const tooltip = document.createElement('div');
  tooltip.className = 'heatmap-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  const showTooltip = (cell, x, y) => {
    const count = Number(cell.dataset.count);
    tooltip.textContent = `${cell.dataset.date} · ${count} 篇文章`;
    tooltip.hidden = false;
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.min(x + 12, window.innerWidth - rect.width - 8)}px`;
    tooltip.style.top = `${Math.max(8, y - rect.height - 12)}px`;
  };
  heatmap.addEventListener('pointerover', (event) => { const cell = event.target.closest('i[data-date]'); if (cell) showTooltip(cell, event.clientX, event.clientY); });
  heatmap.addEventListener('pointermove', (event) => { const cell = event.target.closest('i[data-date]'); if (cell) showTooltip(cell, event.clientX, event.clientY); });
  heatmap.addEventListener('pointerout', (event) => { if (event.target.closest('i[data-date]')) tooltip.hidden = true; });
  heatmap.addEventListener('focusin', (event) => { const cell = event.target.closest('i[data-date]'); if (cell) { const rect = cell.getBoundingClientRect(); showTooltip(cell, rect.left, rect.top); } });
  heatmap.addEventListener('focusout', () => { tooltip.hidden = true; });
  const summary = section.querySelector('.section-heading .muted');
  const updateLatestArticle = (entries) => {
    const latest = entries[0];
    if (!latest) return;
    const latestUrl = latest.url.startsWith('articals/') ? latest.url : `articals/${latest.url}`;
    const presentations = {
      'article-ai-agent.html': {
        title: 'AI Agent 的架构选型：MCP 和 Skills 的核心区别及应用场景分析',
        summary: '从 MCP、API 与 Agent 的连接方式出发，理解 MCP 和 Skills 各自解决的问题与适用场景。',
        category: 'AI AGENT · MCP · SKILLS',
        reading: 'AI Agent · 架构选型'
      },
      'article.html': {
        title: 'KV Cache：大语言模型推理中的关键记忆机制',
        summary: '理解 Attention、KV Cache 与 PagedAttention 如何共同影响推理吞吐量和显存效率。',
        category: 'LLM INFERENCE',
        reading: '阅读约 12 分钟'
      }
    };
    const presentation = presentations[latest.url] || presentations[latestUrl.replace(/^articals\//, '')] || {
      title: latest.title,
      summary: latest.excerpt || '在这里记录新的技术思考与实践。',
      category: 'TECHNICAL BLOG',
      reading: '技术文章'
    };
    const feature = document.querySelector('.feature-band');
    feature.querySelector('h2').textContent = presentation.title;
    feature.querySelector('.muted').textContent = presentation.summary;
    feature.querySelector('.text-link').href = latestUrl;
    feature.querySelector('.eyebrow').textContent = `LATEST ARTICLE · ${presentation.category}`;
    feature.querySelector('.feature-meta strong').textContent = latest.date.replaceAll('-', '.');
    feature.querySelector('.feature-meta span:last-child').textContent = presentation.reading;
  };
  fetch(`data/contributions.json?v=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).catch(() => fallback).then((data) => {
    const years = Object.keys(data.years).sort((a, b) => b - a);
    let selectedYear = years[0] || String(new Date().getFullYear());
    updateLatestArticle(data.years[selectedYear]?.entries || []);
    const render = () => {
      const selected = data.years[selectedYear] || { days: {}, entries: [] };
      const counts = selected.days || {};
      const entries = selected.entries || [];
      const maximum = Math.max(...Object.values(counts), 1);
      const first = new Date(Number(selectedYear), 0, 1);
      const last = new Date(Number(selectedYear), 11, 31);
      heatmap.innerHTML = '';
      for (let blank = 0; blank < first.getDay(); blank += 1) {
        const spacer = document.createElement('i'); spacer.className = 'heatmap-spacer'; spacer.setAttribute('aria-hidden', 'true'); heatmap.appendChild(spacer);
      }
      for (let date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) {
        const key = dateKey(date); const count = counts[key] || 0; const cell = document.createElement('i');
        const intensity = level(count, maximum);
        cell.className = `level-${intensity}`;
        cell.style.backgroundColor = intensity === 0 ? '#e4e5df' : ['#e4e5df', '#c9da83', '#a8bf50', '#849c35', '#5d7628'][intensity];
        cell.dataset.date = key; cell.dataset.count = count; cell.tabIndex = 0; cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${key}: ${count} ${count === 1 ? 'article contribution' : 'article contributions'}`); heatmap.appendChild(cell);
      }
      while (heatmap.children.length % 7 !== 0) {
        const spacer = document.createElement('i'); spacer.className = 'heatmap-spacer'; spacer.setAttribute('aria-hidden', 'true'); heatmap.appendChild(spacer);
      }
      document.querySelector('#contribution-count').textContent = `${entries.length} contributions in ${selectedYear}`;
      if (summary) summary.innerHTML = `${selectedYear} 年发布了 ${entries.length} 篇文章<br>每一次记录，都是一次整理。`;
      document.querySelector('#contribution-history-list').innerHTML = entries.length ? entries.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.submittedAt || '').localeCompare(a.submittedAt || '')).map((entry) => `<a class="history-entry" href="${escapeHtml(entry.url || '#')}"><time>${escapeHtml(entry.date)}</time><span>${escapeHtml(entry.title)}</span><b>↗</b></a>`).join('') : '<p class="history-empty">这一年还没有文章记录。</p>';
      [...yearList.querySelectorAll('button')].forEach((button) => button.classList.toggle('active', button.dataset.year === selectedYear));
    };
    yearList.innerHTML = years.map((year) => `<button type="button" data-year="${year}">${year}</button>`).join('');
    yearList.addEventListener('click', (event) => { const button = event.target.closest('button'); if (button) { selectedYear = button.dataset.year; render(); } });
    render();
  });
}
