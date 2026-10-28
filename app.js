const API_BASE = "";
let tasks = [];
let currentFilter = "all";
let toastTimer;

const $ = (id) => document.getElementById(id);
const dateText = $("dateText");
const today = new Date();
dateText.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
}).format(today);
$("greeting").innerHTML = `${getGreeting()}<span> ✨</span>`;
document.body.classList.toggle("dark-mode", localStorage.getItem("taskflow_theme") === "dark");
$("themeBtn").textContent = document.body.classList.contains("dark-mode") ? "☀" : "☾";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Let's make this morning count";
  if (hour < 17) return "Let's make today count";
  return "Let's finish today strong";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function setConnectionStatus(message, isOnline = false) {
  $("connectionStatus").textContent = message;
  const dot = document.querySelector(".status-dot");
  if (dot) dot.style.background = isOnline ? "#6bd4a6" : "#ffbd76";
}

function localTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem("taskflow_tasks") || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function loadTasks() {
  try {
    tasks = await api("/tasks");
    setConnectionStatus("Backend connected", true);
  } catch {
    tasks = localTasks();
    setConnectionStatus("Local mode");
  }
  render();
  renderCalendar();
}

function persistLocal() {
  localStorage.setItem("taskflow_tasks", JSON.stringify(tasks));
}

async function saveTask(task, id) {
  try {
    if (id) await api(`/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(task) });
    else await api("/tasks", { method: "POST", body: JSON.stringify(task) });
    showToast(id ? "Your task was updated ✨" : "New task added — nice work!");
  } catch (error) {
    if (id) {
      tasks = tasks.map(t => t.id === id ? { ...t, ...task } : t);
    } else {
      tasks.unshift({ ...task, id: makeId(), createdAt: new Date().toISOString() });
    }
    persistLocal();
    setConnectionStatus("Local mode");
    showToast("Saved on this device (local mode)");
  }
  await loadTasks();
}

function makeId() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const completed = !task.completed;
  try {
    await api(`/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ completed }) });
    showToast(completed ? "Task completed. Every win counts! ✓" : "Task moved back to pending");
  } catch {
    task.completed = completed;
    persistLocal();
    setConnectionStatus("Local mode");
    showToast(completed ? "Task completed ✓" : "Task moved back to pending");
  }
  await loadTasks();
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  try {
    await api(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("Task deleted");
  } catch {
    tasks = tasks.filter(t => t.id !== id);
    persistLocal();
    setConnectionStatus("Local mode");
    showToast("Task deleted from this device");
  }
  await loadTasks();
}

function filteredTasks() {
  const search = $("searchInput").value.trim().toLowerCase();
  const priority = $("priorityFilter").value;
  const list = tasks.filter(t => {
    const matchesSearch = !search || `${t.title} ${t.description || ""} ${t.category || ""}`.toLowerCase().includes(search);
    const matchesPriority = priority === "all" || t.priority === priority;
    let matchesView = true;
    if (currentFilter === "pending") matchesView = !t.completed;
    if (currentFilter === "completed") matchesView = t.completed;
    if (currentFilter === "today") matchesView = t.dueDate === localDateString(new Date());
    return matchesSearch && matchesPriority && matchesView;
  });
  const sort = $("sortSelect").value;
  if (sort === "due") list.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  if (sort === "priority") {
    const rank = { urgent: 0, high: 1, medium: 2, low: 3, someday: 4 };
    list.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
  }
  if (sort === "created") list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function render() {
  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  $("totalCount").textContent = tasks.length;
  $("pendingCount").textContent = pending;
  $("completedCount").textContent = completed;
  $("progressCount").textContent = `${percent}%`;
  $("progressBar").style.width = `${percent}%`;

  const list = filteredTasks();
  $("visibleCount").textContent = `${list.length} ${list.length === 1 ? "task" : "tasks"}`;
  $("taskList").innerHTML = list.map(t => {
    const due = t.dueDate ? `<span class="due-label ${!t.completed && t.dueDate < localDateString(new Date()) ? "overdue" : ""}">◷ ${!t.completed && t.dueDate < localDateString(new Date()) ? "Overdue · " : "Due: "}${formatDate(t.dueDate)}</span>` : "";
    const priority = ["urgent", "high", "medium", "low", "someday"].includes(t.priority) ? t.priority : "medium";
    return `
    <article class="task-card ${t.completed ? "done" : ""}">
      <button class="check ${t.completed ? "done" : ""}" onclick="toggleTask('${escapeAttr(t.id)}')" aria-label="${t.completed ? "Mark as pending" : "Mark as complete"}" title="${t.completed ? "Mark as pending" : "Mark as complete"}"></button>
      <div class="task-content">
        <h3 class="task-title">${escapeHtml(t.title)}</h3>
        ${t.description ? `<p class="task-description">${escapeHtml(t.description)}</p>` : ""}
        <div class="meta"><span class="pill priority-${priority}">${priority === "someday" ? "Someday" : priority[0].toUpperCase() + priority.slice(1)}${priority === "someday" ? "" : " priority"}</span>
          ${t.category ? `<span class="pill">${escapeHtml(t.category)}</span>` : ""}${due}
        </div>
      </div>
      <div class="task-actions"><button onclick="openEdit('${escapeAttr(t.id)}')" title="Edit task" aria-label="Edit task">✎</button><button onclick="deleteTask('${escapeAttr(t.id)}')" title="Delete task" aria-label="Delete task">×</button></div>
    </article>`;
  }).join("");

  const empty = list.length === 0;
  $("emptyState").classList.toggle("hidden", !empty);
  if (typeof renderCalendar === "function") renderCalendar();
  if (empty) {
    const hasAny = tasks.length > 0;
    $("emptyTitle").textContent = hasAny ? "No tasks match just yet" : "Your next win starts here";
    $("emptyMessage").textContent = hasAny ? "Try another search or adjust your filters." : "Add a task to get your momentum going.";
    $("emptyAddBtn").classList.toggle("hidden", hasAny);
  }
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }

function openModal(task = null) {
  $("taskModal").classList.remove("hidden");
  $("modalTitle").textContent = task ? "Edit your task" : "Add a new task";
  $("taskId").value = task?.id || "";
  $("title").value = task?.title || "";
  $("description").value = task?.description || "";
  $("dueDate").value = task?.dueDate || "";
  $("priority").value = task?.priority || "medium";
  $("category").value = task?.category || "";
  setTimeout(() => $("title").focus(), 30);
}
function closeModal() { $("taskModal").classList.add("hidden"); }
function openEdit(id) { openModal(tasks.find(t => String(t.id) === String(id)) || null); }

function showToast(message, error = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

// Small interactive month calendar; task data and existing controls remain unchanged.
let calendarCursor = new Date();
function renderCalendar() {
  const year = calendarCursor.getFullYear(), month = calendarCursor.getMonth();
  $("calendarMonth").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarCursor);
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateString(new Date());
  let html = "";
  for (let i = 0; i < first; i++) html += '<span class="calendar-day blank" aria-hidden="true"></span>';
  for (let day = 1; day <= days; day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasTask = tasks.some(t => t.dueDate === key && !t.completed);
    html += `<button type="button" class="calendar-day ${key === todayKey ? "is-today" : ""} ${hasTask ? "has-task" : ""}" data-date="${key}" aria-label="${key}${hasTask ? ", tasks due" : ""}">${day}${hasTask ? '<i></i>' : ""}</button>`;
  }
  $("calendarDays").innerHTML = html;
  $("calendarDays").querySelectorAll("button[data-date]").forEach(btn => btn.addEventListener("click", () => {
    $("dueDate").value = btn.dataset.date;
    openModal();
    $("dueDate").value = btn.dataset.date;
  }));
}
$("calendarPrev").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
$("calendarNext").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
$("focusAddBtn").addEventListener("click", () => openModal());

$("addTaskBtn").onclick = () => openModal();
$("emptyAddBtn").onclick = () => openModal();
$("closeModalBtn").onclick = closeModal;
$("cancelBtn").onclick = closeModal;
$("taskModal").addEventListener("click", e => { if (e.target.id === "taskModal") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

$("taskForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("taskId").value;
  const old = tasks.find(t => String(t.id) === String(id));
  const title = $("title").value.trim();
  if (!title) { $("title").focus(); return; }
  await saveTask({
    title,
    description: $("description").value.trim(),
    dueDate: $("dueDate").value || null,
    priority: $("priority").value,
    category: $("category").value.trim(),
    completed: old?.completed || false
  }, id || null);
  closeModal();
});

document.querySelectorAll(".nav-item").forEach(btn => btn.onclick = () => {
  document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  currentFilter = btn.dataset.filter;
  render();
});
["searchInput", "priorityFilter", "sortSelect"].forEach(id => $(id).addEventListener("input", render));

$("themeBtn").addEventListener("click", () => {
  const enabled = document.body.classList.toggle("dark-mode");
  localStorage.setItem("taskflow_theme", enabled ? "dark" : "light");
  $("themeBtn").textContent = enabled ? "☀" : "☾";
  showToast(enabled ? "Night mode on" : "Light mode on");
});

$("exportBtn").addEventListener("click", () => {
  const headers = ["Title", "Description", "Due date", "Priority", "Category", "Completed", "Created at"];
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = tasks.map(t => [t.title, t.description, t.dueDate, t.priority, t.category, t.completed ? "Yes" : "No", t.createdAt].map(quote).join(","));
  const csv = [headers.map(quote).join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `taskflow-tasks-${localDateString(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Your task list is exported");
});

loadTasks();
