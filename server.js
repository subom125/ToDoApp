const http = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createStore } = require('./store');

const staticFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']]
]);
const statuses = ['todo', 'doing', 'done'];
const priorities = ['low', 'medium', 'high'];
const timezone = 'Asia/Ho_Chi_Minh';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date());

function validate(input) {
  const { title, dueDate, priority, status } = input ?? {};
  const date = typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ? new Date(dueDate + 'T00:00:00Z') : null;
  if (typeof title !== 'string' || !title.trim() || [...title.trim()].length > 120 ||
      !date || Number.isNaN(+date) || date.toISOString().slice(0, 10) !== dueDate ||
      !priorities.includes(priority) || !statuses.includes(status)) return null;
  return { title: title.trim(), dueDate, priority, status };
}

async function readJson(req) {
  let size = 0;
  let body = '';
  req.setEncoding('utf8');
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size <= 8192) body += chunk;
  }
  if (size > 8192) return null;
  try { return JSON.parse(body); } catch { return null; }
}

function statistics(tasks) {
  const counts = { todo: 0, doing: 0, done: 0 };
  for (const task of tasks) counts[task.status]++;
  return { total: tasks.length, ...counts };
}

function sampleTasks(day) {
  return [
    ['Ôn bài Backend', 'high', 'doing'],
    ['Viết README cho dự án', 'medium', 'todo'],
    ['Nộp bài thực hành', 'high', 'done'],
    ['Dọn thư mục tài liệu', 'low', 'done'],
    ['Lên kế hoạch tuần', 'medium', 'todo']
  ].map(([title, priority, status]) => ({ title, priority, status, dueDate: day }));
}

function createServer(store, memory = false) {
  return http.createServer(async (req, res) => {
    const send = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      const day = today();
      if (method === 'GET' && staticFiles.has(path)) {
        const [file, mime] = staticFiles.get(path);
        const content = readFileSync(join(__dirname, 'public', file));
        res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(content);
      }
      if (method === 'GET' && path === '/api/config') return send(200, { today: day, memory });
      if (method === 'GET' && path === '/api/stats') {
        return send(200, statistics(url.searchParams.get('mock') === '1' ? sampleTasks(day) : store.all()));
      }
      if (path === '/api/tasks') {
        if (method === 'GET') {
          const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('vi');
          const status = url.searchParams.get('status');
          const priority = url.searchParams.get('priority');
          return send(200, store.all().filter(task =>
            (url.searchParams.get('scope') === 'all' || task.dueDate === day) &&
            task.title.toLocaleLowerCase('vi').includes(query) &&
            (!status || task.status === status) && (!priority || task.priority === priority)
          ).reverse());
        }
        if (method === 'POST') {
          const task = validate(await readJson(req));
          return task ? send(201, store.add(task)) : send(400, { error: 'Vui lòng kiểm tra tên, ngày, mức ưu tiên và trạng thái.' });
        }
      }
      const match = path.match(/^\/api\/tasks\/([1-9]\d*)$/);
      if (match) {
        const id = Number(match[1]);
        if (Number.isSafeInteger(id)) {
          if (method === 'PUT') {
            const task = validate(await readJson(req));
            if (!task) return send(400, { error: 'Vui lòng kiểm tra thông tin công việc.' });
            const row = store.update(id, task);
            if (row) return send(200, row);
          }
          if (method === 'DELETE' && store.remove(id)) return send(200, { deleted: true });
        }
      }
      return send(404, { error: 'Không tìm thấy tài nguyên.' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(500, { error: 'Máy chủ gặp lỗi. Vui lòng thử lại.' });
      else res.end();
    }
  });
}

if (require.main === module) {
  const memory = process.argv.includes('--memory');
  const port = Number(process.env.PORT ?? 3000);
  const store = createStore(memory);
  if (memory) sampleTasks(today()).forEach(task => store.add(task));
  createServer(store, memory).listen(port, '127.0.0.1', () => {
    console.log(`TODO App: http://127.0.0.1:${port} (${memory ? 'RAM' : 'SQLite'})`);
  });
}

module.exports = { createServer };
