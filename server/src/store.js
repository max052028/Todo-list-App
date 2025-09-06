import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const filePath = path.join(dataDir, "store.json");

const empty = {
  users: {},
  lists: {},
  memberships: {},
  invites: {},
  tasks: {},
};

function ensure() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(empty, null, 2));
}

export function readStore() {
  ensure();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeStore(data) {
  ensure();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function upsert(table, obj) {
  const db = readStore();
  db[table][obj.id] = obj;
  writeStore(db);
  return obj;
}

export function remove(table, id) {
  const db = readStore();
  delete db[table][id];
  writeStore(db);
}

export function findById(table, id) {
  const db = readStore();
  return db[table][id] || null;
}

export function all(table, predicate) {
  const db = readStore();
  const arr = Object.values(db[table] || {});
  return predicate ? arr.filter(predicate) : arr;
}
