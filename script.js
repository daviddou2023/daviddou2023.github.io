const heatmap = document.querySelector('.heatmap');
if (heatmap) {
  for (let i = 0; i < 364; i += 1) {
    const cell = document.createElement('i');
    cell.title = i === 280 ? '2026.10.13 · 发布 1 篇文章' : '暂无文章';
    heatmap.appendChild(cell);
  }
}
