const { readFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

function createStore(memory = false, filename = join(__dirname, 'data', 'tasks.sqlite')) {
  if (memory) {
    const rows = new Map();
    let nextId = 1;
    return {
      all: () => [...rows.values()],
      add(task) {
        const row = { id: nextId++, ...task };
        rows.set(row.id, row);
        return row;
      },
      update(id, task) {
        if (!rows.has(id)) return null;
        const row = { id, ...task };
        rows.set(id, row);
        return row;
      },
      remove: id => rows.delete(id),
      close() {}
    };
  }

  const { DatabaseSync } = require('node:sqlite');
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
  const list = db.prepare('SELECT * FROM tasks ORDER BY id');
  const insert = db.prepare('INSERT INTO tasks(title,dueDate,priority,status) VALUES (?,?,?,?) RETURNING *');
  const update = db.prepare('UPDATE tasks SET title=?,dueDate=?,priority=?,status=? WHERE id=? RETURNING *');
  const remove = db.prepare('DELETE FROM tasks WHERE id=?');
  const values = ({ title, dueDate, priority, status }) => [title, dueDate, priority, status];
  return {
    all: () => list.all(),
    add: task => insert.get(...values(task)),
    update: (id, task) => update.get(...values(task), id),
    remove: id => remove.run(id).changes > 0,
    close: () => db.close()
  };
}

module.exports = { createStore };
