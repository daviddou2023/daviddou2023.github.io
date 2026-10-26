const content = document.querySelector('#article-content');
const toc = document.querySelector('.article-toc');
if (content && toc) {
  const toggle = toc.querySelector('.article-toc-toggle');
  const list = toc.querySelector('.article-toc-list');
  let headingSignature = '';

  const updateCollapsedState = () => {
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const collapsed = mobile || toc.dataset.collapsed === 'true';
    toc.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.article-toc-toggle-label').textContent = collapsed && !mobile ? '显示目录' : '文章目录';
  };

  toggle.addEventListener('click', () => {
    const collapsed = !toc.classList.contains('is-collapsed');
    toc.classList.toggle('is-collapsed', collapsed);
    toc.dataset.collapsed = String(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.article-toc-toggle-label').textContent = collapsed ? '显示目录' : '文章目录';
  });
  window.addEventListener('resize', updateCollapsedState);
  updateCollapsedState();

  const setActive = (heading) => {
    list.querySelectorAll('.article-toc-link').forEach((link) => {
      const active = link.dataset.target === heading.id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    content.querySelectorAll('.toc-current').forEach((item) => item.classList.remove('toc-current'));
    heading.classList.add('toc-current');
  };

  const observer = new IntersectionObserver((observations) => {
    const visible = observations.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) setActive(visible[0].target);
  }, { rootMargin: '-8% 0px -78% 0px', threshold: 0 });

  const buildToc = () => {
    const headings = [...content.querySelectorAll('h2,h3,h4,h5,h6')];
    const signature = headings.map((heading) => `${heading.tagName}:${heading.textContent.trim()}`).join('|');
    if (!headings.length) {
      list.innerHTML = '<p class="article-toc-empty">本文没有目录标题</p>';
      headingSignature = signature;
      return;
    }
    if (signature === headingSignature) return;
    observer.disconnect();
    list.replaceChildren();
    headings.forEach((heading, index) => {
      if (!heading.id) {
        const slug = heading.textContent.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
        heading.id = `${slug}-${index + 1}`;
      }
      const link = document.createElement('a');
      link.className = 'article-toc-link';
      link.href = `#${heading.id}`;
      link.dataset.target = heading.id;
      link.textContent = heading.textContent.trim();
      link.style.paddingLeft = `${8 + (Number(heading.tagName.slice(1)) - 2) * 12}px`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${heading.id}`);
        setActive(heading);
        if (window.matchMedia('(max-width: 700px)').matches) {
          toc.classList.add('is-collapsed');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
      list.append(link);
      observer.observe(heading);
    });
    setActive(headings[0]);
    headingSignature = signature;
  };

  const mutationObserver = new MutationObserver(buildToc);
  mutationObserver.observe(content, { childList: true, subtree: true, characterData: true });
  buildToc();
  if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
}
