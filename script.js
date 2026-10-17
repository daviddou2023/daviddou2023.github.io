document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="contributions.css">');

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
  fetch('data/contributions.json').then((response) => response.ok ? response.json() : Promise.reject()).catch(() => fallback).then((data) => {
    const years = Object.keys(data.years).sort((a, b) => b - a);
    let selectedYear = years[0] || String(new Date().getFullYear());
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
        cell.className = `level-${level(count, maximum)}`; cell.dataset.date = key; cell.dataset.count = count; cell.tabIndex = 0; cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${key}: ${count} ${count === 1 ? 'article contribution' : 'article contributions'}`); heatmap.appendChild(cell);
      }
      while (heatmap.children.length % 7 !== 0) {
        const spacer = document.createElement('i'); spacer.className = 'heatmap-spacer'; spacer.setAttribute('aria-hidden', 'true'); heatmap.appendChild(spacer);
      }
      document.querySelector('#contribution-count').textContent = `${entries.length} contributions in ${selectedYear}`;
      if (summary) summary.innerHTML = `${selectedYear} 年发布了 ${entries.length} 篇文章<br>每一次记录，都是一次整理。`;
      document.querySelector('#contribution-history-list').innerHTML = entries.length ? entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map((entry) => `<a class="history-entry" href="${escapeHtml(entry.url || '#')}"><time>${escapeHtml(entry.date)}</time><span>${escapeHtml(entry.title)}</span><b>↗</b></a>`).join('') : '<p class="history-empty">这一年还没有文章记录。</p>';
      [...yearList.querySelectorAll('button')].forEach((button) => button.classList.toggle('active', button.dataset.year === selectedYear));
    };
    yearList.innerHTML = years.map((year) => `<button type="button" data-year="${year}">${year}</button>`).join('');
    yearList.addEventListener('click', (event) => { const button = event.target.closest('button'); if (button) { selectedYear = button.dataset.year; render(); } });
    render();
  });
}
