import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  ownerId: text("owner_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  listId: text("list_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").$type("owner" | "admin" | "member"),
  createdAt: integer("created_at").notNull(),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  listId: text("list_id").notNull(),
  email: text("email").notNull(),
  invitedBy: text("invited_by").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull(), // pending | accepted | revoked
  createdAt: integer("created_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  listId: text("list_id").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  dueAt: integer("due_at"),
  estimateMin: integer("estimate_min"),
  priority: integer("priority"), // 1-5
  status: text("status").notNull(), // todo | doing | done
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
  createdBy: text("created_by").notNull(),
  assigneeId: text("assignee_id"),
});
