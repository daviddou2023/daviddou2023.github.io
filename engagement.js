// Set this after deploying the Worker, for example https://xixi-site-counter.example.workers.dev.
const engagementApi = 'https://api.daviddou2023.site';

const createVisitorId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const visitorLabel = document.createElement('span');
visitorLabel.className = 'visitor-count';
visitorLabel.textContent = '访客 · —';
visitorLabel.setAttribute('aria-label', '独立访客数暂不可用');
document.querySelector('.site-header')?.append(visitorLabel);

const article = document.querySelector('.article-page');
const articleId = location.pathname.split('/').pop()?.replace(/\.html$/, '');
let likeButton;
let likeCount;
let likeMessage;
if (article && /^(?:article|article-[a-z0-9-]+)$/.test(articleId || '')) {
  const section = document.createElement('section');
  section.className = 'article-like';
  section.setAttribute('aria-label', '文章点赞');
  section.innerHTML = '<button class="article-like-button" type="button" disabled aria-label="给这篇文章点赞"><span class="article-like-heart" aria-hidden="true">♥</span><span class="article-like-action">喜欢</span></button><span class="article-like-count">— 次喜欢</span><span class="article-like-message" role="status" aria-live="polite"></span>';
  article.append(section);
  likeButton = section.querySelector('.article-like-button');
  likeCount = section.querySelector('.article-like-count');
  likeMessage = section.querySelector('.article-like-message');
}

if (engagementApi) {
  const api = engagementApi.replace(/\/$/, '');
  const visitorKey = 'xixi-visitor-id';
  let storage = null;
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const candidate = window[name];
      candidate.setItem('__xixi_storage_test__', '1');
      candidate.removeItem('__xixi_storage_test__');
      storage = candidate;
      break;
    } catch {}
  }
  const readStorage = (key) => {
    try { return storage?.getItem(key) || null; } catch { return null; }
  };
  const writeStorage = (key, value) => {
    try { storage?.setItem(key, value); } catch {}
  };
  let visitorId = readStorage(visitorKey) || window.__xixiVisitorId;
  if (!visitorId) {
    visitorId = createVisitorId();
    window.__xixiVisitorId = visitorId;
    writeStorage(visitorKey, visitorId);
  }
  const request = async (path, options) => {
    const response = await fetch(`${api}${path}`, options);
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  };
  const post = (path, body) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  post('/api/visitors', { visitorId }).then(({ count }) => {
    visitorLabel.textContent = `访客 · ${Number(count).toLocaleString('zh-CN')}`;
    visitorLabel.setAttribute('aria-label', `独立访客 ${count} 人`);
  }).catch(() => {
    visitorLabel.title = '访客数暂时无法加载';
  });

  if (likeButton) {
    const likedKey = `xixi-liked-${articleId}`;
    const markLiked = () => {
      likeButton.disabled = true;
      likeButton.classList.add('is-liked');
      likeButton.setAttribute('aria-label', '已喜欢这篇文章');
      likeButton.querySelector('.article-like-action').textContent = '已喜欢';
    };
    request(`/api/likes/${articleId}`).then(({ count }) => {
      likeCount.textContent = `${count} 次喜欢`;
      if (readStorage(likedKey) === visitorId) markLiked();
      else likeButton.disabled = false;
    }).catch(() => {
      likeCount.textContent = '点赞暂不可用';
    });
    likeButton.addEventListener('click', async () => {
      likeButton.disabled = true;
      try {
        const { count, added } = await post(`/api/likes/${articleId}`, { visitorId });
        likeCount.textContent = `${count} 次喜欢`;
        writeStorage(likedKey, visitorId);
        markLiked();
        likeMessage.textContent = '感谢喜欢';
        if (added) {
          const heart = document.createElement('span');
          heart.className = 'article-like-float';
          heart.setAttribute('aria-hidden', 'true');
          heart.textContent = '♥';
          likeButton.append(heart);
          heart.addEventListener('animationend', () => heart.remove(), { once: true });
        }
      } catch {
        likeButton.disabled = false;
        likeMessage.textContent = '点赞失败，请重试';
      }
    });
  }
} else if (likeCount) {
  likeCount.textContent = '点赞暂不可用';
}
