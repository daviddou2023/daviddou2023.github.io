const json = (data, status = 200, origin = '') => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin'
  }
});

export default {
  async fetch(request, env) {
    const allowedOrigin = new URL(env.SITE_ORIGIN).origin;
    const origin = request.headers.get('Origin');
    if (origin !== allowedOrigin) return json({ error: 'Forbidden origin' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });

    const path = new URL(request.url).pathname;
    const likeMatch = /^\/api\/likes\/(article(?:-[a-z0-9-]+)?)$/.exec(path);
    try {
      if (path === '/api/visitors' && request.method === 'POST') {
        const { visitorId } = await request.json();
        if (!validVisitorId(visitorId)) return json({ error: 'Invalid visitor ID' }, 400, allowedOrigin);
        await env.DB.prepare('INSERT OR IGNORE INTO visitors (id) VALUES (?)').bind(visitorId).run();
        const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM visitors').first();
        return json({ count }, 200, allowedOrigin);
      }
      if (likeMatch && request.method === 'GET') {
        const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM likes WHERE article_id = ?').bind(likeMatch[1]).first();
        return json({ count }, 200, allowedOrigin);
      }
      if (likeMatch && request.method === 'POST') {
        const { visitorId } = await request.json();
        if (!validVisitorId(visitorId)) return json({ error: 'Invalid visitor ID' }, 400, allowedOrigin);
        const result = await env.DB.prepare('INSERT OR IGNORE INTO likes (article_id, visitor_id) VALUES (?, ?)').bind(likeMatch[1], visitorId).run();
        const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM likes WHERE article_id = ?').bind(likeMatch[1]).first();
        return json({ count, added: result.meta.changes > 0 }, 200, allowedOrigin);
      }
      return json({ error: 'Not found' }, 404, allowedOrigin);
    } catch {
      return json({ error: 'Request failed' }, 500, allowedOrigin);
    }
  }
};

function validVisitorId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
