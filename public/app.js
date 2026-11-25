const byId = id => document.getElementById(id);
const statuses = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Hoàn thành' };
const priorities = { low: 'Thấp', medium: 'Vừa', high: 'Cao' };
const form = byId('task-form');
const editor = byId('editor');
const fields = form.elements;
const filters = ['query', 'status-filter', 'priority-filter'].map(byId);
const [query, statusFilter, priorityFilter] = filters;
let config;
let editingId;
let renderVersion = 0;

function addOptions(select, entries) {
  for (const [value, label] of Object.entries(entries)) select.add(new Option(label, value));
}
addOptions(fields.status, statuses);
addOptions(fields.priority, priorities);
addOptions(statusFilter, statuses);
addOptions(priorityFilter, priorities);

async function api(path, options) {
  const response = await fetch('/api/' + path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function openEditor(task) {
  if (!config) return;
  editingId = task?.id;
  byId('editor-title').textContent = task ? 'Sửa công việc' : 'Thêm công việc';
  byId('form-error').textContent = '';
  fields.title.value = task?.title ?? '';
  fields.dueDate.value = task?.dueDate ?? config.today;
  fields.priority.value = task?.priority ?? 'medium';
  fields.status.value = task?.status ?? 'todo';
  editor.showModal();
}

async function removeTask(task, button) {
  if (!confirm('Xóa công việc “' + task.title + '”?')) return;
  button.disabled = true;
  try {
    await api('tasks/' + task.id, { method: 'DELETE' });
    byId('message').textContent = 'Đã xóa công việc.';
    await render();
  } catch (error) {
    byId('message').textContent = error.message;
    button.disabled = false;
  }
}

function taskRow(task) {
  const row = element('li', '', 'task');
  const summary = document.createElement('div');
  const tags = element('div', '', 'tags');
  tags.append(element('span', statuses[task.status], 'tag ' + task.status),
    element('span', 'Ưu tiên ' + priorities[task.priority].toLowerCase(), 'tag ' + task.priority),
    element('time', task.dueDate.split('-').reverse().join('/'), 'tag'));
  summary.append(element('strong', task.title), tags);
  const actions = element('div', '', 'actions');
  const edit = element('button', 'Sửa');
  const remove = element('button', 'Xóa', 'danger');
  edit.setAttribute('aria-label', 'Sửa ' + task.title);
  remove.setAttribute('aria-label', 'Xóa ' + task.title);
  edit.onclick = () => openEditor(task);
  remove.onclick = () => removeTask(task, remove);
  actions.append(edit, remove);
  row.append(summary, actions);
  return row;
}

async function render() {
  const version = ++renderVersion;
  const isStats = location.hash === '#stats';
  byId('today').hidden = isStats;
  byId('stats').hidden = !isStats;
  byId('today-link').toggleAttribute('aria-current', !isStats);
  byId('stats-link').toggleAttribute('aria-current', isStats);
  try {
    if (isStats) {
      const stats = await api('stats?mock=' + Number(byId('mock').checked));
      if (version !== renderVersion) return;
      const labels = { total: 'Tổng công việc', ...statuses };
      byId('metrics').replaceChildren(...Object.entries(labels).map(([key, label]) => {
        const card = element('div', label, 'metric');
        card.append(element('strong', stats[key]));
        return card;
      }));
      const percent = stats.total ? Math.round(100 * stats.done / stats.total) : 0;
      byId('percentage').textContent = percent + '%';
      byId('bar').value = percent;
      return;
    }
    const allDates = byId('all-dates').checked;
    byId('list-title').textContent = allDates ? 'Tất cả công việc' : 'Việc hôm nay';
    const params = new URLSearchParams({
      q: query.value, status: statusFilter.value, priority: priorityFilter.value,
      scope: allDates ? 'all' : 'today'
    });
    const rows = await api('tasks?' + params);
    if (version !== renderVersion) return;
    byId('count').textContent = rows.length ? rows.length + ' công việc' : 'Không có công việc phù hợp.';
    byId('tasks').replaceChildren(...rows.map(taskRow));
  } catch (error) {
    if (version === renderVersion) byId('message').textContent = error.message;
  }
}

form.onsubmit = async event => {
  event.preventDefault();
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  byId('form-error').textContent = '';
  try {
    const task = Object.fromEntries(new FormData(form));
    await api(editingId ? 'tasks/' + editingId : 'tasks', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    editor.close();
    byId('message').textContent = task.dueDate === config.today
      ? 'Đã lưu công việc.' : 'Đã lưu công việc. Danh sách hôm nay chỉ hiển thị việc đến hạn hôm nay.';
    await render();
  } catch (error) {
    byId('form-error').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
byId('add').onclick = () => openEditor();
byId('cancel').onclick = () => editor.close();
for (const filter of filters) filter.addEventListener('input', render);
byId('mock').addEventListener('change', render);
byId('all-dates').addEventListener('change', render);
window.addEventListener('hashchange', render);

(async () => {
  try {
    config = await api('config');
    byId('date').textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: 'UTC' })
      .format(new Date(config.today + 'T00:00:00Z'));
    byId('mode').textContent = config.memory ? 'Dữ liệu tạm trong RAM' : 'Cơ sở dữ liệu SQLite';
    await render();
  } catch (error) {
    byId('message').textContent = error.message;
  }
})();
