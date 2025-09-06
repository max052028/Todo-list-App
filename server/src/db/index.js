import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users, lists, memberships, invites, tasks } from "./schema.js";
import { sql } from "drizzle-orm";

export function createDb(dbFilePath) {
  const sqlite = new Database(dbFilePath);
  const db = drizzle(sqlite);

  // Create tables if not exists (idempotent)
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    email TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    due_at INTEGER,
    estimate_min INTEGER,
    priority INTEGER,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_by TEXT NOT NULL,
    assignee_id TEXT
  )`);

  return { db };
}

export { users, lists, memberships, invites, tasks };
