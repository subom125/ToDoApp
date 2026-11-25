const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { createStore } = require('./store');
const { createServer } = require('./server');

async function start(store, memory) {
  const server = createServer(store, memory).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    async request(path, method = 'GET', body) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = response.headers.get('content-type').includes('application/json')
        ? await response.json() : await response.text();
      return [response.status, data];
    },
    async close() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      store.close();
    }
  };
}

for (const memory of [true, false]) {
  test(memory ? 'HTTP workflow in RAM' : 'HTTP workflow with persistent SQLite', async t => {
    const dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    const file = join(dir, 'tasks.sqlite');
    let app = await start(createStore(memory, file), memory);
    t.after(async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const [home, html] = await app.request('/');
    assert.equal(home, 200);
    assert.match(html, /TODO App/);
    const [, config] = await app.request('/api/config');
    assert.equal(config.memory, memory);
    const task = { title: 'Ôn bài', dueDate: config.today, priority: 'high', status: 'todo' };
    const [created, row] = await app.request('/api/tasks', 'POST', task);
    assert.equal(created, 201);
    const other = { ...task, title: 'Việc khác', dueDate: '2099-01-01' };
    assert.equal((await app.request('/api/tasks', 'POST', other))[0], 201);
    assert.deepEqual(await app.request('/api/tasks'), [200, [row]]);
    assert.equal((await app.request('/api/tasks?scope=all'))[1].length, 2);
    assert.deepEqual(await app.request('/api/tasks?q=' + encodeURIComponent('ÔN') + '&priority=high&status=todo'), [200, [row]]);
    assert.deepEqual(await app.request('/api/tasks?status=done'), [200, []]);
    assert.equal((await app.request('/api/tasks', 'POST', { ...task, dueDate: '2025-02-30' }))[0], 400);
    const path = '/api/tasks/' + row.id;
    assert.equal((await app.request(path, 'PUT', { ...task, status: 'done' }))[1].status, 'done');
    assert.deepEqual(await app.request('/api/stats'), [200, { total: 2, todo: 1, doing: 0, done: 1 }]);
    assert.deepEqual(await app.request('/api/stats?mock=1'), [200, { total: 5, todo: 2, doing: 1, done: 2 }]);
    await app.close();
    app = await start(createStore(memory, file), memory);
    const [, reopened] = await app.request('/api/tasks');
    assert.equal(reopened.length, memory ? 0 : 1);
    if (!memory) assert.equal(reopened[0].status, 'done');
    const [, temporary] = await app.request('/api/tasks', 'POST', task);
    const target = '/api/tasks/' + temporary.id;
    assert.equal((await app.request(target, 'DELETE'))[0], 200);
    assert.equal((await app.request(target, 'DELETE'))[0], 404);
  });
}
