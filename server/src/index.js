import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { all, findById, remove, upsert } from "./store.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));

// JSON store, no external DB

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
  if (!req.userId) {
    const dev = req.header("x-user-id");
    if (dev) req.userId = dev;
  }
  next();
});

// Helpers
const now = () => Date.now();
const id = () => crypto.randomUUID();
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
upsert("users", { id: "demo-user", email: "demo@example.com", name: "Demo", createdAt: now() });

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
  const user = { id: uid, email: emailNorm, name: name?.trim() || emailNorm.split("@")[0], passwordHash, createdAt: now(), googleId: null };
  upsert("users", user);
  const jwtToken = signToken(uid);
  res.cookie(COOKIE_NAME, jwtToken, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
  res.status(201).json({ id: user.id, email: user.email, name: user.name });
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
  res.json({ id: user.id, email: user.email, name: user.name });
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
      user = { id: crypto.randomUUID(), email, name, createdAt: now(), googleId: sub };
    } else {
      user = { ...user, email: user.email || email, name: user.name || name, googleId: user.googleId || sub };
    }
    upsert("users", user);
    const jwtToken = signToken(user.id);
    res.cookie(COOKIE_NAME, jwtToken, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
    res.json({ id: user.id, email: user.email, name: user.name });
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
  res.json({ id: u.id, email: u.email, name: u.name });
});

// Auth gate for the rest of the API
app.use((req, res, next) => {
  if (!req.userId) return res.status(401).json({ error: "unauthorized" });
  next();
});

// Users (old /me route removed; use /auth/me)

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
  const nd = normalizeDueAt(dueAt);
  if (nd === null && dueAt !== null && dueAt !== undefined) return res.status(400).json({ error: "invalid dueAt" });
  const t = { id: id(), listId, title, notes: notes ?? null, dueAt: nd ?? null, estimateMin: estimateMin ?? null, priority: priority ?? null, status: "todo", createdAt: now(), completedAt: null, createdBy: req.userId, assigneeId: assigneeId ?? null };
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
  let dueAtPatch = {};
  if (dueAt !== undefined) {
    const nd2 = normalizeDueAt(dueAt);
    if (nd2 === null && dueAt !== null) return res.status(400).json({ error: "invalid dueAt" });
    dueAtPatch = { dueAt: nd2 ?? null };
  }
  const updated = { ...t, ...(title !== undefined && { title }), ...(notes !== undefined && { notes }), ...dueAtPatch, ...(estimateMin !== undefined && { estimateMin }), ...(priority !== undefined && { priority }), ...(status !== undefined && { status, completedAt }), ...(assigneeId !== undefined && { assigneeId }) };
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
