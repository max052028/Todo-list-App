import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import multer from "multer";
import { all, findById, remove, upsert } from "./store.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));

// JSON store, no external DB
// Static uploads dir (public)
const uploadDir = path.resolve(process.cwd(), "data", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

// Multer setup for avatar uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || mimetypeToExt(file.mimetype) || ".bin";
    const base = `${req.userId || "anon"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, base + ext);
  }
});
function mimetypeToExt(mt) {
  if (!mt) return "";
  if (mt === "image/jpeg") return ".jpg";
  if (mt === "image/png") return ".png";
  if (mt === "image/webp") return ".webp";
  if (mt === "image/gif") return ".gif";
  return "";
}
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) return cb(new Error("only image uploads allowed"));
    cb(null, true);
  }
});

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = process.env.SESSION_COOKIE || "sid";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

// Middleware: resolve user from cookie or dev header fallback
app.use((req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = payload.sub;
    } catch {
      res.clearCookie(COOKIE_NAME);
      req.userId = undefined;
    }
  }
  next();
});

// Helpers
const now = () => Date.now();
const id = () => crypto.randomUUID();
function recordEvent(listId, type, data = {}) {
  const ev = { id: id(), listId, type, at: now(), actorId: null, data };
  return ev;
}
// Normalize various dueAt inputs to epoch ms (number) or null; undefined means unchanged
function normalizeDueAt(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    // Has timezone (Z or +/-)
    if (/Z|[\+\-]\d{2}:?\d{2}$/.test(s)) {
      const n = Date.parse(s);
      return Number.isNaN(n) ? null : n;
    }
    // Local datetime without timezone: YYYY-MM-DDTHH:mm(:ss)?
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const Y = Number(m[1]);
      const M = Number(m[2]);
      const D = Number(m[3]);
      const h = Number(m[4]);
      const min = Number(m[5]);
      const sec = Number(m[6] || 0);
      return new Date(Y, M - 1, D, h, min, sec, 0).getTime();
    }
  }
  return null;
}

// Bootstrap demo user
upsert("users", { id: "demo-user", email: "demo@example.com", name: "Demo", createdAt: now(), avatar: null, gender: null, birthday: null });

// Public routes
// Health
app.get("/health", (req, res) => res.json({ ok: true }));
// Public auth config (safe to expose client id)
app.get("/auth/config", (req, res) => {
  res.json({ googleClientId });
});

// Auth
app.post("/auth/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const emailNorm = String(email).trim().toLowerCase();
  const exists = all("users", u => (u.email || "").toLowerCase() === emailNorm)[0];
  if (exists) return res.status(409).json({ error: "email already in use" });
  const uid = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = { id: uid, email: emailNorm, name: name?.trim() || emailNorm.split("@")[0], passwordHash, createdAt: now(), googleId: null, avatar: null, gender: null, birthday: null };
  upsert("users", user);
  const jwtToken = signToken(uid);
  res.cookie(COOKIE_NAME, jwtToken, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const emailNorm = String(email).trim().toLowerCase();
  const user = all("users", u => (u.email || "").toLowerCase() === emailNorm)[0];
  if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const jwtToken = signToken(user.id);
  res.cookie(COOKIE_NAME, jwtToken, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
  res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar });
});

app.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: "idToken required" });
    if (!googleClient) return res.status(500).json({ error: "Google not configured" });
  const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
  const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "invalid token" });
    const sub = payload.sub;
    const email = (payload.email || "").toLowerCase();
    const name = payload.name || email.split("@")[0] || "User";
  // optional logging for debugging (can be removed in prod)
  // console.log("Google payload", { sub, email, name });
    let user = all("users", u => u.googleId === sub)[0];
    if (!user && email) {
      user = all("users", u => (u.email || "").toLowerCase() === email)[0];
    }
    if (!user) {
      user = { id: crypto.randomUUID(), email, name, createdAt: now(), googleId: sub, avatar: payload.picture || null, gender: null, birthday: null };
    } else {
      user = { ...user, email: user.email || email, name: user.name || name, googleId: user.googleId || sub, avatar: user.avatar || payload.picture || null };
    }
    upsert("users", user);
    const jwtToken = signToken(user.id);
    res.cookie(COOKIE_NAME, jwtToken, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
    res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar });
  } catch (e) {
    console.error("/auth/google error", e?.message || e);
    res.status(401).json({ error: "google auth failed" });
  }
});

app.post("/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "unauthorized" });
  const u = findById("users", req.userId);
  if (!u) return res.status(401).json({ error: "unauthorized" });
  res.json({ id: u.id, email: u.email, name: u.name, avatar: u.avatar ?? null, hasPassword: !!u.passwordHash });
});

// Auth gate for the rest of the API
app.use((req, res, next) => {
  if (!req.userId) return res.status(401).json({ error: "unauthorized" });
  next();
});

// Users (old /me route removed; use /auth/me)
// Profile: get my full profile
app.get("/users/me", (req, res) => {
  const u = findById("users", req.userId);
  if (!u) return res.status(404).json({ error: "not found" });
  res.json({ id: u.id, email: u.email, name: u.name, avatar: u.avatar ?? null, gender: u.gender ?? null, birthday: u.birthday ?? null, hasPassword: !!u.passwordHash });
});

// Update profile (non-sensitive fields)
app.patch("/users/me", (req, res) => {
  const u = findById("users", req.userId);
  if (!u) return res.status(404).json({ error: "not found" });
  let { name, avatar, gender, birthday } = req.body ?? {};
  const next = { ...u };
  if (name !== undefined) next.name = String(name).trim() || u.name;
  if (avatar !== undefined) next.avatar = (avatar === null || avatar === "") ? null : String(avatar);
  if (gender !== undefined) {
    const g = (gender === null || gender === "") ? null : String(gender);
    if (g && !["male", "female", "other"].includes(g)) return res.status(400).json({ error: "invalid gender" });
    next.gender = g;
  }
  if (birthday !== undefined) {
    const b = (birthday === null || birthday === "") ? null : String(birthday);
    if (b && !/^\d{4}-\d{2}-\d{2}$/.test(b)) return res.status(400).json({ error: "invalid birthday" });
    next.birthday = b;
  }
  upsert("users", next);
  res.json({ id: next.id, email: next.email, name: next.name, avatar: next.avatar, gender: next.gender, birthday: next.birthday });
});

// Change password: requires oldPassword and newPassword
app.patch("/users/me/password", async (req, res) => {
  const u = findById("users", req.userId);
  if (!u) return res.status(404).json({ error: "not found" });
  const { oldPassword, newPassword } = req.body ?? {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: "oldPassword and newPassword required" });
  if (!u.passwordHash) return res.status(400).json({ error: "password not set for this account" });
  const ok = await bcrypt.compare(String(oldPassword), u.passwordHash);
  if (!ok) return res.status(401).json({ error: "incorrect old password" });
  if (String(newPassword).length < 8) return res.status(400).json({ error: "new password too short (min 8)" });
  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  upsert("users", { ...u, passwordHash });
  res.json({ ok: true });
});

// Upload avatar
app.post("/users/me/avatar", upload.single("file"), (req, res) => {
  const u = findById("users", req.userId);
  if (!u) return res.status(404).json({ error: "not found" });
  if (!req.file) return res.status(400).json({ error: "file required" });
  // Cleanup previous avatar if it was a local upload
  const prev = u.avatar;
  try {
    if (prev && /^\/(api\/)?uploads\//.test(prev)) {
      const rel = prev.replace(/^\/api/, "");
      const filePath = path.join(process.cwd(), rel.startsWith("/") ? rel.slice(1) : rel);
      if (filePath.startsWith(uploadDir)) {
        fs.unlink(filePath, () => {});
      }
    }
  } catch {}
  const publicPath = `/uploads/${req.file.filename}`;
  const clientUrl = `/api${publicPath}`;
  const next = { ...u, avatar: publicPath };
  upsert("users", next);
  res.json({ url: publicPath, clientUrl });
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
  // event
  upsert("events", recordEvent(listId, "list.created", { name, color, ownerId: req.userId, actorId: req.userId }));
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
  upsert("events", recordEvent(listId, "list.updated", { name: name ?? null, color: color ?? null, actorId: req.userId }));
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
  upsert("events", recordEvent(listId, "list.deleted", { actorId: req.userId }));
  res.status(204).end();
});

// Memberships
app.get("/lists/:id/members", (req, res) => {
  const listId = req.params.id;
  const ms = all("memberships", m => m.listId === listId);
  const enriched = ms.map(m => {
    const u = findById("users", m.userId);
  const displayName = u?.name || u?.email || m.userId;
  return { ...m, displayName, avatar: u?.avatar ?? null, gender: u?.gender ?? null, email: u?.email ?? null };
  });
  res.json(enriched);
});

app.patch("/lists/:id/members/:userId", (req, res) => {
  const listId = req.params.id;
  const targetUserId = req.params.userId;
  const me = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!me || me.role !== "owner") return res.status(403).json({ error: "only owner can change roles" });
  const { role } = req.body ?? {};
  if (!role || !["owner", "admin", "member"].includes(role)) return res.status(400).json({ error: "invalid role" });
  const members = all("memberships", m => m.listId === listId);
  const target = members.find(x => x.userId === targetUserId);
  if (!target) return res.status(404).json({ error: "not found" });
  // Prevent removing the last owner on a list
  if (target.role === "owner" && role !== "owner") {
    const owners = members.filter(m => m.role === "owner");
    if (owners.length <= 1) {
      return res.status(400).json({ error: "cannot remove last owner" });
    }
  }
  // Also prevent a caller from demoting themselves to non-owner if they'd be leaving zero owners
  if (req.userId === targetUserId && role !== "owner") {
    const owners = members.filter(m => m.role === "owner");
    if (owners.length <= 1) {
      return res.status(400).json({ error: "cannot leave list without an owner" });
    }
  }
  upsert("memberships", { ...target, role });
  upsert("events", recordEvent(listId, "member.role_changed", { targetUserId, role, actorId: req.userId }));
  res.json({ ok: true });
});

// Invites (email-less token flow for MVP)
app.post("/lists/:id/invites", (req, res) => {
  const listId = req.params.id;
  const me = all("memberships", x => x.listId === listId && x.userId === req.userId)[0];
  if (!me || (me.role !== "owner" && me.role !== "admin")) return res.status(403).json({ error: "forbidden" });
  // Reuse existing pending invite to make it "permanent"
  const existing = all("invites", i => i.listId === listId && i.status === "pending")[0];
  if (existing) {
    return res.status(200).json({ ...existing, joinUrl: `/join/${existing.token}` });
  }
  const token = crypto.randomBytes(16).toString("hex");
  const inv = { id: id(), listId, email: (req.body?.email ?? ""), invitedBy: req.userId, token, status: "pending", createdAt: now() };
  upsert("invites", inv);
  upsert("events", recordEvent(listId, "invite.created", { invitedBy: req.userId, token, email: inv.email, actorId: req.userId }));
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
  upsert("events", recordEvent(inv.listId, "invite.accepted", { userId: req.userId, actorId: req.userId }));
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
  const nd = normalizeDueAt(dueAt);
  if (nd === null && dueAt !== null && dueAt !== undefined) return res.status(400).json({ error: "invalid dueAt" });
  const t = { id: id(), listId, title, notes: notes ?? null, dueAt: nd ?? null, estimateMin: estimateMin ?? null, priority: priority ?? null, status: "todo", createdAt: now(), completedAt: null, createdBy: req.userId, assigneeId: assigneeId ?? null };
  upsert("tasks", t);
  upsert("events", recordEvent(listId, "task.created", { taskId: t.id, title: t.title, assigneeId: t.assigneeId ?? null, actorId: req.userId }));
  res.status(201).json(t);
});

app.patch("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const t = findById("tasks", taskId);
  if (!t) return res.status(404).json({ error: "not found" });
  const auth = all("memberships", x => x.listId === t.listId && x.userId === req.userId)[0];
  if (!auth) return res.status(403).json({ error: "forbidden" });
  const canAdmin = ['owner','admin'].includes(auth.role);
  const isAssignee = t.assigneeId === req.userId;
  const isCreator = t.createdBy === req.userId;
  const canEdit = canAdmin || isCreator || isAssignee;
  if (!canEdit) return res.status(403).json({ error: "insufficient rights" });
  const { title, notes, dueAt, estimateMin, priority, status, assigneeId } = req.body ?? {};
  // Only assignee can toggle completion state
  if (status !== undefined && status !== t.status) {
    if (!isAssignee && !canAdmin) return res.status(403).json({ error: "only assignee or admin can change status" });
  }
  const completedAt = status === "done" && t.status !== "done" ? now() : (status !== undefined ? null : t.completedAt);
  let dueAtPatch = {};
  if (dueAt !== undefined) {
    const nd2 = normalizeDueAt(dueAt);
    if (nd2 === null && dueAt !== null) return res.status(400).json({ error: "invalid dueAt" });
    dueAtPatch = { dueAt: nd2 ?? null };
  }
  const updated = { ...t, ...(title !== undefined && { title }), ...(notes !== undefined && { notes }), ...dueAtPatch, ...(estimateMin !== undefined && { estimateMin }), ...(priority !== undefined && { priority }), ...(status !== undefined && { status, completedAt }), ...(assigneeId !== undefined && { assigneeId }) };
  upsert("tasks", updated);
  // More specific events
  if (status !== undefined && status !== t.status) {
    upsert("events", recordEvent(t.listId, status === "done" ? "task.completed" : "task.reopened", { taskId: t.id, actorId: req.userId }));
  } else if (assigneeId !== undefined && assigneeId !== t.assigneeId) {
    upsert("events", recordEvent(t.listId, "task.reassigned", { taskId: t.id, from: t.assigneeId ?? null, to: assigneeId ?? null, actorId: req.userId }));
  } else {
    upsert("events", recordEvent(t.listId, "task.updated", { taskId: t.id, changed: Object.keys({ ...(title!==undefined&&{title}), ...(notes!==undefined&&{notes}), ...(dueAt!==undefined&&{dueAt}), ...(estimateMin!==undefined&&{estimateMin}), ...(priority!==undefined&&{priority}) }), actorId: req.userId }));
  }
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
  upsert("events", recordEvent(t.listId, "task.deleted", { taskId, actorId: req.userId }));
  res.status(204).end();
});

// Global view: all tasks across lists for current user
app.get("/tasks", (req, res) => {
  const ms = all("memberships", m => m.userId === req.userId);
  const listIds = new Set(ms.map(m => m.listId));
  const data = all("tasks", t => listIds.has(t.listId));
  res.json(data);
});

// Events feed (paginated)
app.get("/lists/:id/events", (req, res) => {
  const listId = req.params.id;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const events = all("events", e => e.listId === listId).sort((a,b)=> b.at - a.at);
  const total = events.length;
  const start = (page - 1) * pageSize;
  const slice = events.slice(start, start + pageSize).map(ev => {
    const actor = ev.data?.actorId || ev.actorId || null;
    const u = actor ? findById("users", actor) : null;
    const actorName = u?.name || u?.email || actor || null;
    const actorEmail = u?.email || null;
    return { ...ev, actorName, actorEmail };
  });
  res.json({ page, pageSize, total, items: slice });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
