document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="contributions.css">');
const heatmap = document.querySelector('.heatmap');
if (heatmap) {
  const fallback = { years: { 2026: { days: { '2026-10-13': 1 }, entries: [{ date: '2026-10-13', title: 'KV Cache：大语言模型推理中的关键记忆机制', url: 'article.html' }] } } };
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const formatDate = (key) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00`));
  const level = (count, maximum) => count === 0 ? 0 : Math.min(4, Math.ceil((count / Math.max(maximum, 1)) * 4));
  const section = heatmap.closest('.contribution-section');
  const layout = document.createElement('div'); layout.className = 'contribution-layout';
  const originalWrap = heatmap.parentElement; originalWrap.replaceWith(layout); layout.appendChild(originalWrap);
  const main = layout.firstElementChild; const toolbar = document.createElement('div'); toolbar.className = 'contribution-toolbar';
  toolbar.innerHTML = '<span class="contribution-count" id="contribution-count"></span><div class="contribution-legend"><span>少</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>多</span></div>'; main.prepend(toolbar);
  const history = document.createElement('div'); history.className = 'contribution-history'; history.innerHTML = '<h3>文章提交记录</h3><div id="contribution-history-list"></div>'; main.appendChild(history);
  const yearList = document.createElement('aside'); yearList.className = 'year-list'; yearList.setAttribute('aria-label', '历史年份'); layout.appendChild(yearList);
  const summary = section.querySelector('.section-heading .muted');
  fetch('data/contributions.json').then((response) => response.ok ? response.json() : Promise.reject()).catch(() => fallback).then((data) => {
    const years = Object.keys(data.years).sort((a, b) => b - a); let selectedYear = years[0] || String(new Date().getFullYear());
    const render = () => { const selected = data.years[selectedYear] || { days: {}, entries: [] }; const counts = selected.days || {}; const entries = selected.entries || []; const maximum = Math.max(...Object.values(counts), 1);
      const first = new Date(Number(selectedYear), 0, 1); first.setDate(first.getDate() - first.getDay()); const last = new Date(Number(selectedYear), 11, 31); last.setDate(last.getDate() + (6 - last.getDay())); heatmap.innerHTML = '';
      for (let date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) { const key = dateKey(date); const count = counts[key] || 0; const cell = document.createElement('i'); cell.className = `level-${level(count, maximum)}`; cell.title = `${formatDate(key)} · ${count} 篇文章`; heatmap.appendChild(cell); }
      document.querySelector('#contribution-count').textContent = `${entries.length} contributions in ${selectedYear}`; if (summary) summary.innerHTML = `${selectedYear} 年发布了 ${entries.length} 篇文章<br>每一次记录，都是一次整理。`;
      document.querySelector('#contribution-history-list').innerHTML = entries.length ? entries.sort((a, b) => b.date.localeCompare(a.date)).map((entry) => `<a class="history-entry" href="${esc(entry.url || '#')}"><time>${esc(entry.date)}</time><span>${esc(entry.title)}</span><b>↗</b></a>`).join('') : '<p class="history-empty">这一年还没有文章记录。</p>'; [...yearList.querySelectorAll('button')].forEach((button) => button.classList.toggle('active', button.dataset.year === selectedYear));
    };
    yearList.innerHTML = years.map((year) => `<button type="button" data-year="${year}">${year}</button>`).join(''); yearList.addEventListener('click', (event) => { const button = event.target.closest('button'); if (button) { selectedYear = button.dataset.year; render(); } }); render();
  });
}
