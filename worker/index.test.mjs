import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './index.mjs';

const origin = 'https://daviddou2023.github.io';
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';

function environment() {
  const visitors = new Set();
  const likes = new Set();
  return {
    SITE_ORIGIN: origin,
    DB: {
      prepare(sql) {
        let args;
        return {
          bind(...values) { args = values; return this; },
          async run() {
            const set = sql.includes('visitors') ? visitors : likes;
            const key = args.join(':');
            const added = !set.has(key);
            set.add(key);
            return { meta: { changes: Number(added) } };
          },
          async first() {
            if (sql.includes('visitors')) return { count: visitors.size };
            return { count: [...likes].filter((key) => key.startsWith(`${args[0]}:`)).length };
          }
        };
      }
    }
  };
}

async function call(env, path, method = 'GET', visitorId = firstId, requestOrigin = origin) {
  const response = await worker.fetch(new Request(`https://counter.example${path}`, {
    method,
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ visitorId }) : undefined
  }), env);
  return { status: response.status, body: await response.json() };
}

test('one browser counts once across visits; another browser adds one', async () => {
  const env = environment();
  assert.deepEqual((await call(env, '/api/visitors', 'POST')).body, { count: 1 });
  assert.deepEqual((await call(env, '/api/visitors', 'POST')).body, { count: 1 });
  assert.deepEqual((await call(env, '/api/visitors', 'POST', secondId)).body, { count: 2 });
});

test('likes are unique per browser and article', async () => {
  const env = environment();
  assert.deepEqual((await call(env, '/api/likes/article', 'POST')).body, { count: 1, added: true });
  assert.deepEqual((await call(env, '/api/likes/article', 'POST')).body, { count: 1, added: false });
  assert.deepEqual((await call(env, '/api/likes/article', 'POST', secondId)).body, { count: 2, added: true });
  assert.deepEqual((await call(env, '/api/likes/article-other')).body, { count: 0 });
});

test('rejects other origins and invalid IDs', async () => {
  const env = environment();
  assert.equal((await call(env, '/api/visitors', 'POST', firstId, 'https://other.example')).status, 403);
  assert.equal((await call(env, '/api/visitors', 'POST', 'invalid')).status, 400);
});
