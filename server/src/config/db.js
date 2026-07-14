const path = require('path');
const fs = require('fs');
const config = require('./index');

let db = null;
let SQL = null;

/**
 * Initialize and get database instance.
 * Uses sql.js (pure WASM, no native compilation) for cross-platform compatibility.
 */
async function getDb() {
  if (db) return db;

  if (!SQL) {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }

  // Ensure data directory exists
  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(config.db.path)) {
    const buffer = fs.readFileSync(config.db.path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like journaling and foreign keys
  db.run('PRAGMA foreign_keys = ON');
  // Note: sql.js doesn't support all runtime PRAGMAs like WAL mode (WASM limitation)
  // But it's fine for small-scale deployment

  initTables(db);
  return db;
}

function initTables(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK(role IN ('admin', 'student')),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      course_id INTEGER REFERENCES courses(id),
      category_id INTEGER REFERENCES categories(id),
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      uploader_id INTEGER REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      review_note TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at DATETIME,
      download_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS download_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER REFERENCES resources(id),
      user_id INTEGER REFERENCES users(id),
      ip_address VARCHAR(45),
      downloaded_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS visit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      ip_address VARCHAR(45),
      user_agent TEXT,
      visited_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      published_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: add course_id column to existing resources table (if missing)
  try {
    database.run('ALTER TABLE resources ADD COLUMN course_id INTEGER REFERENCES courses(id)');
  } catch (e) {}

  // Migration: add last_login_at column to users table (if missing)
  try {
    database.run("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
  } catch (e) {}

  // Migration: add disclaimer_accepted_at column to users table (if missing)
  try {
    database.run("ALTER TABLE users ADD COLUMN disclaimer_accepted_at DATETIME");
  } catch (e) {}

  // Migration: add user_id column to visit_logs table (if missing)
  try {
    database.run("ALTER TABLE visit_logs ADD COLUMN user_id INTEGER REFERENCES users(id)");
  } catch (e) {}

  // Migration: add is_visible column to resources table (for unpublish feature)
  try {
    database.run("ALTER TABLE resources ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1");
  } catch (e) {}

  // Indexes (must run after migrations so columns exist)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)',
    'CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_resources_course ON resources(course_id)',
    'CREATE INDEX IF NOT EXISTS idx_resources_uploader ON resources(uploader_id)',
    'CREATE INDEX IF NOT EXISTS idx_download_logs_resource ON download_logs(resource_id)',
    'CREATE INDEX IF NOT EXISTS idx_download_logs_user ON download_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_visit_logs_date ON visit_logs(visited_at)',
    'CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)',
    'CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at)',
  ];
  for (const idx of indexes) {
    database.run(idx);
  }
}

/**
 * Save database to disk
 */
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.db.path, buffer);
}

/**
 * Close database
 */
function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

/**
 * Helper: Convert sql.js exec result to an array of objects
 * @param {Array} execResult - Result from db.exec()
 * @returns {Array<Object>}
 */
function rowsToObjects(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const { columns, values } = execResult[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Execute a SELECT query and return all matching rows
 * @param {string} sql
 * @param {Array} params
 * @returns {Array<Object>}
 */
function queryAll(sql, params = []) {
  const database = getDbSync();
  const result = database.exec(sql, params);
  return rowsToObjects(result);
}

/**
 * Execute a SELECT query and return the first matching row
 * @param {string} sql
 * @param {Array} params
 * @returns {Object|undefined}
 */
function queryOne(sql, params = []) {
  const database = getDbSync();
  const result = database.exec(sql, params);
  const rows = rowsToObjects(result);
  return rows.length > 0 ? rows[0] : undefined;
}

/**
 * Execute an INSERT/UPDATE/DELETE query
 * @param {string} sql
 * @param {Array} params
 * @returns {{ changes: number, lastInsertRowid: number }}
 */
function execute(sql, params = []) {
  const database = getDbSync();
  database.run(sql, params);
  const result = database.exec('SELECT changes() as changes, last_insert_rowid() as lastInsertRowid');
  const info = rowsToObjects(result)[0];
  saveDb();
  return {
    changes: info.changes,
    lastInsertRowid: info.lastInsertRowid,
  };
}

// Synchronous accessor (will throw if called before init)
function getDbSync() {
  if (!db) throw new Error('Database not initialized. Call await getDb() first.');
  return db;
}

module.exports = { getDb, closeDb, queryAll, queryOne, execute, saveDb };
