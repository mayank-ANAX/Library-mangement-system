/**
 * Relational SQLite Database engine for Library Management System
 * Uses sql.js (WebAssembly SQLite3 engine) with on-disk persistence
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

let dbInstance: SqlJsDatabase | null = null;
const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_PATH = path.resolve(DB_DIR, 'library.db');

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enforce foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Initialize schema
  initializeSchema(dbInstance);

  // Seed demo data if needed
  await seedDemoData(dbInstance);

  saveDb();
  return dbInstance;
}

let inTransaction = false;

export function saveDb(): void {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

function initializeSchema(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'librarian')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      total_copies INTEGER NOT NULL CHECK(total_copies >= 0),
      available_copies INTEGER NOT NULL CHECK(available_copies >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      member_type TEXT NOT NULL CHECK(member_type IN ('Student', 'Faculty', 'Staff')),
      joined_on TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      fine REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL CHECK(status IN ('Issued', 'Returned')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
    CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
    CREATE INDEX IF NOT EXISTS idx_members_code ON members(member_code);
    CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_member ON issues(member_id);
    CREATE INDEX IF NOT EXISTS idx_issues_book ON issues(book_id);
  `);
}

async function seedDemoData(db: SqlJsDatabase): Promise<void> {
  // Check if users exist
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  stmt.step();
  const userCount = (stmt.getAsObject() as { count: number }).count;
  stmt.free();

  if (userCount > 0) {
    return; // Already seeded
  }

  // 1. Seed Staff Users
  const adminHash = await bcrypt.hash('admin123', 10);
  const libHash = await bcrypt.hash('lib12345', 10);

  db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', adminHash, 'admin']);
  db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['librarian', libHash, 'librarian']);

  // 2. Seed Books
  const seedBooks = [
    { isbn: '9780134685991', title: 'Effective Java', author: 'Joshua Bloch', category: 'Computer Science', total: 6, avail: 4 },
    { isbn: '9780132350884', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Engineering', total: 8, avail: 5 },
    { isbn: '9780262033848', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'Computer Science', total: 10, avail: 7 },
    { isbn: '9781491957660', title: 'Fluent Python', author: 'Luciano Ramalho', category: 'Programming Languages', total: 5, avail: 3 },
    { isbn: '9780073523323', title: 'Database System Concepts', author: 'Abraham Silberschatz', category: 'Databases', total: 7, avail: 5 },
    { isbn: '9780133594140', title: 'Computer Networks', author: 'Andrew S. Tanenbaum', category: 'Networking', total: 6, avail: 4 },
    { isbn: '9781119456339', title: 'Operating System Concepts', author: 'Peter B. Galvin', category: 'Computer Science', total: 7, avail: 6 },
    { isbn: '9780136042594', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell', category: 'Artificial Intelligence', total: 5, avail: 3 },
    { isbn: '9781119548041', title: 'Machine Learning with Python', author: 'Andreas C. Müller', category: 'Data Science', total: 6, avail: 5 },
    { isbn: '9780078022128', title: 'Software Engineering: A Practitioner’s Approach', author: 'Roger S. Pressman', category: 'Software Engineering', total: 8, avail: 8 },
  ];

  for (const b of seedBooks) {
    db.run(
      'INSERT INTO books (isbn, title, author, category, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)',
      [b.isbn, b.title, b.author, b.category, b.total, b.avail]
    );
  }

  // 3. Seed Members
  const seedMembers = [
    { code: 'M001', name: 'Aarav Sharma', email: 'aarav.sharma@campus.edu', phone: '9876543210', type: 'Student', joined: '2026-08-01', active: 1 },
    { code: 'M002', name: 'Dr. Priya Venkatesh', email: 'priya.venkatesh@faculty.edu', phone: '9845123456', type: 'Faculty', joined: '2025-01-15', active: 1 },
    { code: 'M003', name: 'Rohan Deshmukh', email: 'rohan.d@campus.edu', phone: '8765432109', type: 'Student', joined: '2026-08-10', active: 1 },
    { code: 'M004', name: 'Ananya Iyer', email: 'ananya.iyer@campus.edu', phone: '9123456780', type: 'Student', joined: '2026-09-01', active: 1 },
    { code: 'M005', name: 'Prof. Rajesh Kulkarni', email: 'rajesh.k@faculty.edu', phone: '9988776655', type: 'Faculty', joined: '2024-07-20', active: 1 },
    { code: 'M006', name: 'Meera Nair', email: 'meera.nair@staff.edu', phone: '7890123456', type: 'Staff', joined: '2025-11-05', active: 1 },
    { code: 'M007', name: 'Kabir Patel', email: 'kabir.patel@campus.edu', phone: '6789012345', type: 'Student', joined: '2026-02-14', active: 0 }, // Inactive member for rule testing
  ];

  for (const m of seedMembers) {
    db.run(
      'INSERT INTO members (member_code, name, email, phone, member_type, joined_on, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [m.code, m.name, m.email, m.phone, m.type, m.joined, m.active]
    );
  }

  // 4. Seed Circulation Transactions (Returned, Active, and Overdue)
  // Let's create realistic past and current dates
  // M001: 1 active normal issue, 1 returned past issue
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [1, 1, '2026-10-01', '2026-10-15', null, 0, 'Issued']
  );
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [2, 1, '2026-09-01', '2026-09-15', '2026-09-14', 0, 'Returned']
  );

  // M002: 1 returned with late fine (due 2026-09-10, returned 2026-09-15 => 5 days late => fine = 10)
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [3, 2, '2026-08-27', '2026-09-10', '2026-09-15', 10.0, 'Returned']
  );

  // M003: 1 overdue issue (due 2026-09-28, today is Oct 2026 => overdue!)
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [4, 3, '2026-09-14', '2026-09-28', null, 0, 'Issued']
  );

  // M004: 1 active issue
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [5, 4, '2026-10-02', '2026-10-16', null, 0, 'Issued']
  );

  // M005: 1 active issue & 1 overdue issue
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [6, 5, '2026-09-10', '2026-09-24', null, 0, 'Issued'] // overdue
  );
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [8, 5, '2026-10-05', '2026-10-19', null, 0, 'Issued']
  );

  // M006: 1 returned
  db.run(
    'INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [9, 6, '2026-09-12', '2026-09-26', '2026-09-25', 0, 'Returned']
  );
}

/**
 * Execute parameterized query returning array of rows
 */
export function query<T = Record<string, unknown>>(sql: string, params: (string | number | boolean | null)[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params as (number | string | null | Uint8Array)[]);
  }
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Execute query returning single row or null
 */
export function queryOne<T = Record<string, unknown>>(sql: string, params: (string | number | boolean | null)[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute parameterized run statement
 */
export function run(sql: string, params: (string | number | boolean | null)[] = []): { changes: number; lastInsertRowid: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params as (number | string | null | Uint8Array)[]);
  
  const lastIdStmt = dbInstance.prepare('SELECT last_insert_rowid() as id');
  lastIdStmt.step();
  const lastId = (lastIdStmt.getAsObject() as { id: number }).id;
  lastIdStmt.free();

  const changesStmt = dbInstance.prepare('SELECT changes() as changes');
  changesStmt.step();
  const changes = (changesStmt.getAsObject() as { changes: number }).changes;
  changesStmt.free();

  saveDb();
  return { changes, lastInsertRowid: lastId };
}

/**
 * Atomic transaction wrapper
 */
export function transaction<T>(fn: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized');
  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    inTransaction = false;
    saveDb();
    return result;
  } catch (error) {
    try {
      dbInstance.run('ROLLBACK;');
    } catch {
      // Ignore if transaction already rolled back
    }
    inTransaction = false;
    throw error;
  }
}
