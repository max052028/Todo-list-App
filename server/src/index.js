import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { all, findById, remove, upsert } from "./store.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));

// JSON store, no external DB

// Middleware: fake auth using header X-User-Id (for MVP)
app.use((req, res, next) => {
  req.userId = req.header("x-user-id") || "demo-user";
  next();
});

// Helpers
const now = () => Date.now();
const id = () => crypto.randomUUID();

// Bootstrap demo user
upsert("users", { id: "demo-user", email: "demo@example.com", name: "Demo", createdAt: now() });

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// Users (minimal)
app.get("/me", (req, res) => {
  res.json(findById("users", req.userId));
});

// Lists CRUD
app.get("/lists", (req, res) => {
  const ms = all("memberships", m => m.userId === req.userId);
  const listIds = new Set(ms.map(m => m.listId));
  const data = all("lists", l => listIds.has(l.id));
  res.json(data);
});

app.post("/lists", (req, res) => {
  const { name, color } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name required" });
  const listId = id();
  const l = { id: listId, name, color: color ?? null, ownerId: req.userId, createdAt: now() };
  upsert("lists", l);
  upsert("memberships", { id: id(), listId, userId: req.userId, role: "owner", createdAt: now() });
  res.status(201).json(l);
});

app.patch("/lists/:id", (req, res) => {
  const listId = req.params.id;
  const m = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!m || (m.role !== "owner" && m.role !== "admin")) return res.status(403).json({ error: "forbidden" });
  const { name, color } = req.body ?? {};
  const l0 = findById("lists", listId);
  const l = { ...l0, ...(name && { name }), ...(color && { color }) };
  upsert("lists", l);
  res.json(l);
});

app.delete("/lists/:id", (req, res) => {
  const listId = req.params.id;
  const m = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!m || m.role !== "owner") return res.status(403).json({ error: "only owner can delete" });
  all("tasks", t => t.listId === listId).forEach(t => remove("tasks", t.id));
  all("memberships", ms => ms.listId === listId).forEach(ms => remove("memberships", ms.id));
  all("invites", i => i.listId === listId).forEach(i => remove("invites", i.id));
  remove("lists", listId);
  res.status(204).end();
});

// Memberships
app.get("/lists/:id/members", (req, res) => {
  const listId = req.params.id;
  res.json(all("memberships", m => m.listId === listId));
});

app.patch("/lists/:id/members/:userId", (req, res) => {
  const listId = req.params.id;
  const targetUserId = req.params.userId;
  const me = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!me || me.role !== "owner") return res.status(403).json({ error: "only owner can change roles" });
  const { role } = req.body ?? {};
  if (!role || !["owner", "admin", "member"].includes(role)) return res.status(400).json({ error: "invalid role" });
  const target = all("memberships", x => x.listId === listId && x.userId === targetUserId)[0];
  if (!target) return res.status(404).json({ error: "not found" });
  upsert("memberships", { ...target, role });
  res.json({ ok: true });
});

// Invites (email-less token flow for MVP)
app.post("/lists/:id/invites", (req, res) => {
  const listId = req.params.id;
  const me = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!me || (me.role !== "owner" && me.role !== "admin")) return res.status(403).json({ error: "forbidden" });
  const token = crypto.randomBytes(16).toString("hex");
  const inv = { id: id(), listId, email: (req.body?.email ?? ""), invitedBy: req.userId, token, status: "pending", createdAt: now() };
  upsert("invites", inv);
  res.status(201).json({ ...inv, joinUrl: `/join/${token}` });
});

app.post("/join/:token", (req, res) => {
  const token = req.params.token;
  const inv = all("invites", i => i.token === token)[0];
  if (!inv || inv.status !== "pending") return res.status(400).json({ error: "invalid invite" });
  // Ensure user exists
  const u = findById("users", req.userId);
  if (!u) upsert("users", { id: req.userId, email: `${req.userId}@example.com`, name: req.userId, createdAt: now() });
  const existing = all("memberships", x => x.listId === inv.listId && x.userId === req.userId)[0];
  if (!existing) upsert("memberships", { id: id(), listId: inv.listId, userId: req.userId, role: "member", createdAt: now() });
  upsert("invites", { ...inv, status: "accepted" });
  res.json({ ok: true, listId: inv.listId });
});

// Tasks
app.get("/lists/:id/tasks", (req, res) => {
  const listId = req.params.id;
  const auth = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!auth) return res.status(403).json({ error: "forbidden" });
  res.json(all("tasks", t => t.listId === listId));
});

app.post("/lists/:id/tasks", (req, res) => {
  const listId = req.params.id;
  const auth = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!auth) return res.status(403).json({ error: "forbidden" });
  if (!['owner','admin'].includes(auth.role)) return res.status(403).json({ error: "only owner/admin can create tasks" });
  const { title, notes, dueAt, estimateMin, priority, assigneeId } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });
  const t = { id: id(), listId, title, notes: notes ?? null, dueAt: dueAt ?? null, estimateMin: estimateMin ?? null, priority: priority ?? null, status: "todo", createdAt: now(), completedAt: null, createdBy: req.userId, assigneeId: assigneeId ?? null };
  upsert("tasks", t);
  res.status(201).json(t);
});

app.patch("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const t = findById("tasks", taskId);
  if (!t) return res.status(404).json({ error: "not found" });
  const auth = all("memberships", x => x.listId === t.listId && x.userId === req.userId)[0];
  if (!auth) return res.status(403).json({ error: "forbidden" });
  const canAdmin = ['owner','admin'].includes(auth.role);
  const canEdit = canAdmin || t.createdBy === req.userId || t.assigneeId === req.userId;
  if (!canEdit) return res.status(403).json({ error: "insufficient rights" });
  const { title, notes, dueAt, estimateMin, priority, status, assigneeId } = req.body ?? {};
  const completedAt = status === "done" && t.status !== "done" ? now() : (status !== undefined ? null : t.completedAt);
  const updated = { ...t, ...(title !== undefined && { title }), ...(notes !== undefined && { notes }), ...(dueAt !== undefined && { dueAt }), ...(estimateMin !== undefined && { estimateMin }), ...(priority !== undefined && { priority }), ...(status !== undefined && { status, completedAt }), ...(assigneeId !== undefined && { assigneeId }) };
  upsert("tasks", updated);
  res.json(updated);
});

app.delete("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const t = findById("tasks", taskId);
  if (!t) return res.status(404).json({ error: "not found" });
  const auth = all("memberships", x => x.listId === t.listId && x.userId === req.userId)[0];
  if (!auth) return res.status(403).json({ error: "forbidden" });
  const canAdmin = ['owner','admin'].includes(auth.role);
  const canDelete = canAdmin || t.createdBy === req.userId;
  if (!canDelete) return res.status(403).json({ error: "insufficient rights" });
  remove("tasks", taskId);
  res.status(204).end();
});

// Global view: all tasks across lists for current user
app.get("/tasks", (req, res) => {
  const ms = all("memberships", m => m.userId === req.userId);
  const listIds = new Set(ms.map(m => m.listId));
  const data = all("tasks", t => listIds.has(t.listId));
  res.json(data);
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
