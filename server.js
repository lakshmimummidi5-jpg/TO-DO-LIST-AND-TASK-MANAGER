const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// In-memory demo storage is used when Supabase environment variables are absent.
let demoTasks = [];

function cleanTask(body = {}) {
  return {
    title: String(body.title || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    due_date: body.dueDate || null,
    priority: ["someday", "low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium",
    category: body.category ? String(body.category).trim() : null,
    completed: Boolean(body.completed)
  };
}

function toClient(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date ?? row.dueDate ?? null,
    priority: row.priority,
    category: row.category,
    completed: Boolean(row.completed),
    createdAt: row.created_at ?? row.createdAt
  };
}

function updatePayload(body) {
  const raw = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) raw.title = String(body.title || "").trim();
  if (Object.prototype.hasOwnProperty.call(body, "description")) raw.description = body.description ? String(body.description).trim() : null;
  if (Object.prototype.hasOwnProperty.call(body, "dueDate")) raw.due_date = body.dueDate || null;
  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    if (!["someday", "low", "medium", "high", "urgent"].includes(body.priority)) return { error: "Priority must be someday, low, medium, high, or urgent" };
    raw.priority = body.priority;
  }
  if (Object.prototype.hasOwnProperty.call(body, "category")) raw.category = body.category ? String(body.category).trim() : null;
  if (Object.prototype.hasOwnProperty.call(body, "completed")) raw.completed = Boolean(body.completed);
  return { raw };
}

app.get("/api/health", (req, res) => res.json({ ok: true, database: Boolean(supabase), mode: supabase ? "supabase" : "demo" }));

app.get("/api/tasks", async (req, res) => {
  if (!supabase) return res.json(demoTasks);
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(toClient));
  } catch (error) {
    return res.status(500).json({ error: "Unable to load tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  const task = cleanTask(req.body);
  if (!task.title) return res.status(400).json({ error: "Title is required" });
  if (task.title.length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });
  if (!supabase) {
    const row = { id: crypto.randomUUID(), ...task, created_at: new Date().toISOString() };
    demoTasks.unshift(row);
    return res.status(201).json(toClient(row));
  }
  try {
    const { data, error } = await supabase.from("tasks").insert(task).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toClient(data));
  } catch (error) {
    return res.status(500).json({ error: "Unable to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const { raw, error: validationError } = updatePayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  if (raw.title !== undefined && !raw.title) return res.status(400).json({ error: "Title cannot be empty" });
  if (raw.title && raw.title.length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });

  if (!supabase) {
    const index = demoTasks.findIndex(task => task.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Task not found" });
    demoTasks[index] = { ...demoTasks[index], ...raw, updated_at: new Date().toISOString() };
    return res.json(toClient(demoTasks[index]));
  }
  try {
    const { data, error } = await supabase.from("tasks").update(raw).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Task not found" });
    return res.json(toClient(data));
  } catch (error) {
    return res.status(500).json({ error: "Unable to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  if (!supabase) {
    const before = demoTasks.length;
    demoTasks = demoTasks.filter(task => task.id !== req.params.id);
    if (before === demoTasks.length) return res.status(404).json({ error: "Task not found" });
    return res.status(204).end();
  }
  try {
    const { data, error } = await supabase.from("tasks").delete().eq("id", req.params.id).select("id").maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Task not found" });
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ error: "Unable to delete task" });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

app.listen(PORT, () => {
  console.log(`TaskFlow running at http://localhost:${PORT}`);
  console.log(`Storage mode: ${supabase ? "Supabase" : "demo (in-memory)"}`);
});
