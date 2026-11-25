CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
  dueDate TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'done'))
) STRICT;
CREATE INDEX IF NOT EXISTS tasks_due_date ON tasks(dueDate);
