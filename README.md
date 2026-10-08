# Library Management System (LMS)

A production-quality, full-stack Library Management System engineered for a single-branch library to replace manual registers and spreadsheets. Features complete book cataloging, member registration, automated circulation, overdue fine calculations, role-based security, analytics, and transaction reporting with CSV export.

---

## 1. System Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, responsive single-page architecture adhering to the enterprise SaaS design system.
- **Backend**:
  - **Node.js / Express Server** (`server.ts`): REST API engine using `sql.js` (WebAssembly SQLite) with persistent disk storage (`database/library.db`), JWT authentication, bcrypt password hashing, and atomic transactions.
  - **Python / Flask Suite** (`backend/`): Standard Flask 3.0 + SQLAlchemy 2.0 ORM implementation with identical endpoints, models, validation services, seed script, and pytest test suite.
- **Database**: Relational SQLite3 database schema (`database/schema.sql`) enforcing foreign keys, indexes, check constraints, and unique indexes on ISBN and email.

---

## 2. Staff Roles & Permissions

| Feature / Operation | Administrator (`admin`) | Librarian (`librarian`) |
| :--- | :---: | :---: |
| Access Circulation Dashboard | Full | Full |
| View Books Catalog & Search | Full | Full |
| Add / Edit Book Titles | Full | Full |
| Delete Book (No Issue History) | **Allowed** | **Denied (HTTP 403)** |
| Register & Edit Members | Full | Full |
| Toggle Member Status | Full | Full |
| Issue Book to Cardholder | Full | Full |
| Return Book & Compute Fines | Full | Full |
| View Transactions Ledger | Full | Full |
| Overdue & Popularity Reports | Full | Full |
| Export Circulation CSV | Full | Full |

*Note: Role enforcement is strictly implemented on the backend. Unauthorized requests return HTTP 403 Forbidden.*

---

## 3. Demo Credentials

| Role | Username | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full administrative control, catalog deletion |
| **Librarian** | `librarian` | `lib12345` | Circulation desk, catalog management |

> **Security Notice**: These are DEMO credentials pre-seeded for evaluation. In production environments, passwords must be changed immediately.

---

## 4. Core Business Rules

1. **Loan Period**: Standard borrowing period is **14 calendar days**. Due date is automatically computed as `issue_date + 14 days`.
2. **Borrowing Limit**: A member can hold a maximum of **3 active books** simultaneously.
3. **Overdue Penalty**: Late fee is **₹2 per day** after the scheduled due date:
   $$\text{late\_days} = \max(0, \text{return\_date} - \text{due\_date})$$
   $$\text{fine} = \text{late\_days} \times ₹2.00$$
4. **Availability Enforcement (Rule 1)**: A book cannot be checked out if `available_copies < 1`.
5. **No Duplicate Holding (Rule 2)**: A member cannot borrow the same book/title twice simultaneously.
6. **Overdue Block (Rule 4)**: A member with any overdue book is blocked from issuing additional books until late loans are returned.
7. **Active Member Check (Rule 5)**: Inactive member accounts cannot borrow books.
8. **Deletion Restriction**: A book cannot be deleted if any circulation or issue history exists.

---

## 5. REST API Documentation

### Authentication
- `POST /api/auth/login` - Authenticate staff username/password, returns signed JWT token.
- `POST /api/auth/logout` - Invalidate session.
- `GET /api/auth/me` - Get profile and role of authenticated user.

### Dashboard & Analytics
- `GET /api/dashboard` - Live circulation statistics, copy distribution, overdue alerts, and most borrowed titles.

### Books Management
- `GET /api/books` - Search by title, author, ISBN; filter by category and availability.
- `POST /api/books` - Add book with server-side validation (10/13 digit ISBN, unique constraint).
- `GET /api/books/:id` - Book details, available copies, and circulation status.
- `PUT /api/books/:id` - Update book details (total copies cannot be less than current loans).
- `DELETE /api/books/:id` - Delete book (*Admin only*, rejected if circulation history exists).

### Members Management
- `GET /api/members` - List cardholders with search (name, email, phone, code) and status filters.
- `POST /api/members` - Register cardholder (validates 10-digit Indian phone `^[6-9][0-9]{9}$`).
- `GET /api/members/:id` - Member profile, active loans count, overdue status, and loan history.
- `PUT /api/members/:id` - Update member information.
- `PATCH /api/members/:id/status` - Toggle Active / Inactive status.

### Issue & Circulation
- `GET /api/issues/check-eligibility` - Pre-flight validation against all 5 core rules.
- `POST /api/issues` - Atomic book issue transaction (decrements available copies, computes due date).
- `GET /api/issues` - Circulation transactions ledger with status and search filters.
- `GET /api/issues/:id` - Transaction details.
- `POST /api/issues/:id/return` - Atomic return transaction (restores available copy, calculates fine).

### Reports & CSV Export
- `GET /api/reports/overdue` - Overdue loans with borrower contacts, days late, and accrued fines.
- `GET /api/reports/most-borrowed` - Most borrowed titles ranking.
- `GET /api/reports/transactions/export` - Export full transactions ledger to CSV format.

---

## 6. Local Setup & Execution

### Prerequisites
- Node.js (v18 or higher)
- npm or bun

### Installation
```bash
# Clone the repository and install dependencies
npm install
```

### Run Full-Stack Development Server
```bash
# Starts Express REST API and mounts Vite frontend on port 3000
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Automated Backend Tests (24 Test Cases)
```bash
# Runs the full test suite validating all 24 required business rules and security invariants
npm test
```

### Python / Flask Alternative Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py
pytest tests/test_library.py
python app.py
```

---

## 7. Deployment Guides (Vercel & Netlify)

### Vercel Deployment (Vercel Services)
The project is configured for Vercel Services multi-service deployment (`vercel.json`):
1. **Configuration (`vercel.json`)**:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "services": {
       "app": {
         "root": ".",
         "framework": "vite",
         "bindings": [
           {
             "type": "service",
             "service": "backend",
             "format": "url",
             "env": "BACKEND_URL"
           }
         ]
       },
       "backend": {
         "root": "backend",
         "framework": "flask"
       }
     },
     "rewrites": [
       { "source": "/api/(.*)", "destination": { "service": "backend" } },
       { "source": "/(.*)", "destination": { "service": "app" } }
     ]
   }
   ```
2. **Local Multi-Service Development**:
   Run both the frontend and backend services together locally with binding injection:
   ```bash
   vercel dev
   ```
3. **Environment Variables**:
   In your Vercel Project Settings under **Environment Variables**, set:
   - `JWT_SECRET`: `your-secure-production-jwt-key`
   - `FLASK_SECRET_KEY`: `your-secure-production-flask-key`
4. **Deploy via Vercel CLI / GitHub**:
   ```bash
   vercel --prod
   ```

### Netlify Deployment
1. **Configuration**: `netlify.toml` is pre-configured with `command = "npm run build"`, `publish = "dist"`, and SPA rewrites (`/* -> /index.html 200`).
2. **Environment Variables**: Configure `NODE_VERSION=20`, `JWT_SECRET`, and `VITE_API_URL=/api`.
3. **Deploy via CLI**:
   ```bash
   netlify deploy --build --prod
   ```

---

## 8. Database Schema Overview

```sql
-- 1. Staff Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'librarian')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Books Catalog
CREATE TABLE books (
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

-- 3. Library Members
CREATE TABLE members (
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

-- 4. Circulation Issues
CREATE TABLE issues (
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
```
