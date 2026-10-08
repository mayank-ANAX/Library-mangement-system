-- Library Management System Schema
-- SQLite3 Relational Database Schema

PRAGMA foreign_keys = ON;

-- 1. USERS: Staff accounts (Admin & Librarian)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'librarian')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. BOOKS: Book inventory
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

-- 3. MEMBERS: Library cardholders
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

-- 4. ISSUES: Circulation transactions
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_members_code ON members(member_code);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_member ON issues(member_id);
CREATE INDEX IF NOT EXISTS idx_issues_book ON issues(book_id);
