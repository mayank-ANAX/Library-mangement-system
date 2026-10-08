/**
 * Full-Stack Express Server for Library Management System
 * Serves REST APIs and mounts Vite development middleware / static production files
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDb, query, queryOne, run } from './server/db.ts';
import { 
  validateBookInput, 
  validateMemberInput, 
  normalizeISBN, 
  normalizePhone 
} from './server/validation.ts';
import { 
  issueBook, 
  returnBook, 
  validateIssueEligibility, 
  canDeleteBook, 
  getCurrentlyBorrowedCopies,
  getTodayStr,
  getDaysDiff,
  Book,
  Member,
  IssueTransaction
} from './server/services.ts';
import { 
  generateToken, 
  requireAuth, 
  requireRole, 
  AuthenticatedRequest, 
  AuthUser 
} from './server/auth.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// CORS & Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Initialize database on startup
await getDb();

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = queryOne<{ id: number; username: string; password_hash: string; role: 'admin' | 'librarian' }>(
      'SELECT * FROM users WHERE username = ?',
      [String(username).trim()]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const authUser: AuthUser = { id: user.id, username: user.username, role: user.role };
    const token = generateToken(authUser);

    res.json({
      message: 'Login successful',
      token,
      user: authUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// ==========================================
// DASHBOARD ANALYTICS ROUTE
// ==========================================

// GET /api/dashboard
app.get('/api/dashboard', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const today = getTodayStr();

    // 1. Total book titles & copy metrics
    const bookStats = queryOne<{ titles: number; total_copies: number; available_copies: number }>(`
      SELECT 
        COUNT(*) as titles,
        COALESCE(SUM(total_copies), 0) as total_copies,
        COALESCE(SUM(available_copies), 0) as available_copies
      FROM books
    `);

    // 2. Circulation metrics
    const issueStats = queryOne<{ issued_count: number; returned_count: number; total_fines: number }>(`
      SELECT
        COUNT(CASE WHEN status = 'Issued' THEN 1 END) as issued_count,
        COUNT(CASE WHEN status = 'Returned' THEN 1 END) as returned_count,
        COALESCE(SUM(fine), 0) as total_fines
      FROM issues
    `);

    // 3. Member stats
    const memberStats = queryOne<{ total: number; active: number }>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN active = 1 THEN 1 END) as active
      FROM members
    `);

    // 4. Overdue count and pending fines
    const overdueIssues = query<IssueTransaction>(`
      SELECT i.*, b.title as book_title, m.name as member_name, m.phone as member_phone
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      WHERE i.status = 'Issued' AND i.due_date < ?
      ORDER BY i.due_date ASC
    `, [today]);

    let pendingOverdueFines = 0;
    const overdueWithFines = overdueIssues.map(issue => {
      const daysLate = Math.max(0, getDaysDiff(issue.due_date, today));
      const fineSoFar = daysLate * 2;
      pendingOverdueFines += fineSoFar;
      return {
        ...issue,
        days_late: daysLate,
        fine_so_far: fineSoFar
      };
    });

    // 5. Recent transactions
    const recentTransactions = query<IssueTransaction>(`
      SELECT i.*, b.title as book_title, b.isbn as book_isbn, m.name as member_name, m.member_code
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      ORDER BY i.id DESC
      LIMIT 6
    `);

    // 6. Most borrowed books
    const mostBorrowed = query<{ id: number; title: string; author: string; category: string; borrow_count: number }>(`
      SELECT b.id, b.title, b.author, b.category, COUNT(i.id) as borrow_count
      FROM books b
      LEFT JOIN issues i ON i.book_id = b.id
      GROUP BY b.id
      ORDER BY borrow_count DESC, b.title ASC
      LIMIT 5
    `);

    // 7. Category distribution
    const categories = query<{ category: string; book_count: number; total_copies: number }>(`
      SELECT category, COUNT(*) as book_count, SUM(total_copies) as total_copies
      FROM books
      GROUP BY category
      ORDER BY book_count DESC
    `);

    // 8. Member types distribution
    const memberTypes = query<{ member_type: string; count: number }>(`
      SELECT member_type, COUNT(*) as count
      FROM members
      GROUP BY member_type
    `);

    res.json({
      stats: {
        totalTitles: bookStats?.titles ?? 0,
        totalCopies: bookStats?.total_copies ?? 0,
        availableCopies: bookStats?.available_copies ?? 0,
        issuedBooks: issueStats?.issued_count ?? 0,
        returnedBooks: issueStats?.returned_count ?? 0,
        totalMembers: memberStats?.total ?? 0,
        activeMembers: memberStats?.active ?? 0,
        overdueBooks: overdueWithFines.length,
        collectedFines: issueStats?.total_fines ?? 0,
        pendingFines: pendingOverdueFines,
        totalFines: (issueStats?.total_fines ?? 0) + pendingOverdueFines
      },
      recentTransactions,
      overdueAlerts: overdueWithFines.slice(0, 5),
      mostBorrowed,
      categories,
      memberTypes
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
});

// ==========================================
// BOOKS MANAGEMENT ROUTES
// ==========================================

// GET /api/books
app.get('/api/books', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, category, availability } = req.query;
    let sql = `
      SELECT b.*,
        (b.total_copies - b.available_copies) as issued_copies,
        CASE 
          WHEN b.available_copies = 0 THEN 'Unavailable'
          WHEN b.available_copies < b.total_copies THEN 'Partially Available'
          ELSE 'Available'
        END as status
      FROM books b
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(b.title) LIKE ? OR LOWER(b.author) LIKE ? OR LOWER(b.isbn) LIKE ?)`;
      params.push(term, term, term);
    }

    if (category && typeof category === 'string' && category !== 'All') {
      sql += ` AND b.category = ?`;
      params.push(category);
    }

    if (availability && typeof availability === 'string' && availability !== 'All') {
      if (availability === 'Available') {
        sql += ` AND b.available_copies = b.total_copies`;
      } else if (availability === 'Partially Available') {
        sql += ` AND b.available_copies > 0 AND b.available_copies < b.total_copies`;
      } else if (availability === 'Unavailable') {
        sql += ` AND b.available_copies = 0`;
      }
    }

    sql += ' ORDER BY b.title ASC';
    const books = query<Book & { status: string; issued_copies: number }>(sql, params);
    res.json({ books });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to load books catalog.' });
  }
});

// POST /api/books
app.post('/api/books', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = validateBookInput(req.body, false);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0].message, errors: validation.errors });
      return;
    }

    const { isbn, title, author, category, total_copies } = req.body;
    const cleanISBN = normalizeISBN(isbn);
    const total = Number(total_copies);

    // Check duplicate ISBN
    const existing = queryOne<Book>('SELECT id FROM books WHERE isbn = ?', [cleanISBN]);
    if (existing) {
      res.status(409).json({ error: 'A book with this ISBN already exists in the catalog.' });
      return;
    }

    const result = run(
      `INSERT INTO books (isbn, title, author, category, total_copies, available_copies)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanISBN, title.trim(), author.trim(), category.trim(), total, total]
    );

    const created = queryOne<Book>('SELECT * FROM books WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Book added successfully', book: created });
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ error: 'Failed to create book record.' });
  }
});

// GET /api/books/:id
app.get('/api/books/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const book = queryOne<Book>('SELECT * FROM books WHERE id = ?', [id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const activeIssues = query<IssueTransaction>(`
      SELECT i.*, m.name as member_name, m.member_code, m.email as member_email
      FROM issues i
      JOIN members m ON m.id = i.member_id
      WHERE i.book_id = ? AND i.status = 'Issued'
    `, [id]);

    const canDelete = canDeleteBook(id);

    res.json({
      book: {
        ...book,
        issued_copies: book.total_copies - book.available_copies,
        can_delete: canDelete.allowed,
        cannot_delete_reason: canDelete.reason
      },
      activeIssues
    });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to retrieve book.' });
  }
});

// PUT /api/books/:id
app.put('/api/books/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<Book>('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const currentlyBorrowed = getCurrentlyBorrowedCopies(id);
    const validation = validateBookInput(req.body, true, currentlyBorrowed);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0].message, errors: validation.errors });
      return;
    }

    const { isbn, title, author, category, total_copies } = req.body;
    const cleanISBN = isbn ? normalizeISBN(isbn) : existing.isbn;

    // Check duplicate ISBN on other books
    if (cleanISBN !== existing.isbn) {
      const duplicate = queryOne<Book>('SELECT id FROM books WHERE isbn = ? AND id != ?', [cleanISBN, id]);
      if (duplicate) {
        res.status(409).json({ error: 'Another book already exists with this ISBN.' });
        return;
      }
    }

    const newTotal = total_copies !== undefined ? Number(total_copies) : existing.total_copies;
    // Calculate new available copies based on currently borrowed copies
    const newAvailable = newTotal - currentlyBorrowed;

    run(
      `UPDATE books 
       SET isbn = ?, title = ?, author = ?, category = ?, total_copies = ?, available_copies = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cleanISBN,
        title !== undefined ? title.trim() : existing.title,
        author !== undefined ? author.trim() : existing.author,
        category !== undefined ? category.trim() : existing.category,
        newTotal,
        newAvailable,
        id
      ]
    );

    const updated = queryOne<Book>('SELECT * FROM books WHERE id = ?', [id]);
    res.json({ message: 'Book updated successfully', book: updated });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /api/books/:id (Admin-only, requires no transaction history)
app.delete('/api/books/:id', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const book = queryOne<Book>('SELECT * FROM books WHERE id = ?', [id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const check = canDeleteBook(id);
    if (!check.allowed) {
      res.status(400).json({ error: check.reason });
      return;
    }

    run('DELETE FROM books WHERE id = ?', [id]);
    res.json({ message: `Book '${book.title}' was deleted successfully.` });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// ==========================================
// MEMBER MANAGEMENT ROUTES
// ==========================================

// GET /api/members
app.get('/api/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, type, status } = req.query;
    let sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM issues i WHERE i.member_id = m.id AND i.status = 'Issued') as active_loans_count,
        (SELECT COUNT(*) FROM issues i WHERE i.member_id = m.id AND i.status = 'Issued' AND i.due_date < ?) as overdue_count
      FROM members m
      WHERE 1=1
    `;
    const today = getTodayStr();
    const params: (string | number)[] = [today];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(m.name) LIKE ? OR LOWER(m.email) LIKE ? OR LOWER(m.phone) LIKE ? OR LOWER(m.member_code) LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (type && typeof type === 'string' && type !== 'All') {
      sql += ` AND m.member_type = ?`;
      params.push(type);
    }

    if (status && typeof status === 'string' && status !== 'All') {
      sql += ` AND m.active = ?`;
      params.push(status === 'Active' ? 1 : 0);
    }

    sql += ' ORDER BY m.member_code ASC';
    const members = query<Member & { overdue_count: number }>(sql, params);
    res.json({
      members: members.map(m => ({
        ...m,
        has_overdue: m.overdue_count > 0
      }))
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to load library members.' });
  }
});

// POST /api/members
app.post('/api/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = validateMemberInput(req.body, false);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0].message, errors: validation.errors });
      return;
    }

    const { name, email, phone, member_type } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);

    // Unique email check
    const existingEmail = queryOne<Member>('SELECT id FROM members WHERE LOWER(email) = ?', [cleanEmail]);
    if (existingEmail) {
      res.status(409).json({ error: 'A member with this email address already exists.' });
      return;
    }

    // Generate sequential member code e.g. M008
    const maxRow = queryOne<{ max_id: number }>('SELECT COALESCE(MAX(id), 0) as max_id FROM members');
    const nextNum = (maxRow?.max_id ?? 0) + 1;
    const memberCode = `M${String(nextNum).padStart(3, '0')}`;
    const joinedOn = getTodayStr();

    const result = run(
      `INSERT INTO members (member_code, name, email, phone, member_type, joined_on, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [memberCode, name.trim(), cleanEmail, cleanPhone, member_type, joinedOn]
    );

    const created = queryOne<Member>('SELECT * FROM members WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Member created successfully', member: created });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to register new member.' });
  }
});

// GET /api/members/:id
app.get('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const member = queryOne<Member>('SELECT * FROM members WHERE id = ?', [id]);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const today = getTodayStr();
    const loans = query<IssueTransaction>(`
      SELECT i.*, b.title as book_title, b.isbn as book_isbn, b.author as book_author, b.category as book_category
      FROM issues i
      JOIN books b ON b.id = i.book_id
      WHERE i.member_id = ?
      ORDER BY i.id DESC
    `, [id]);

    const activeLoans = loans.filter(l => l.status === 'Issued').map(l => {
      const daysLate = Math.max(0, getDaysDiff(l.due_date, today));
      return {
        ...l,
        is_overdue: today > l.due_date,
        days_late: daysLate,
        fine_so_far: daysLate * 2
      };
    });

    const returnedLoans = loans.filter(l => l.status === 'Returned');
    const hasOverdue = activeLoans.some(l => l.is_overdue);

    res.json({
      member: {
        ...member,
        active_loans_count: activeLoans.length,
        remaining_capacity: Math.max(0, 3 - activeLoans.length),
        has_overdue: hasOverdue
      },
      activeLoans,
      history: returnedLoans
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Failed to load member profile.' });
  }
});

// PUT /api/members/:id
app.put('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<Member>('SELECT * FROM members WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const validation = validateMemberInput(req.body, true);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0].message, errors: validation.errors });
      return;
    }

    const { name, email, phone, member_type, active } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : existing.email;

    if (cleanEmail !== existing.email) {
      const duplicate = queryOne<Member>('SELECT id FROM members WHERE LOWER(email) = ? AND id != ?', [cleanEmail, id]);
      if (duplicate) {
        res.status(409).json({ error: 'Another member is already registered with this email.' });
        return;
      }
    }

    const newActive = active !== undefined ? (active ? 1 : 0) : existing.active;

    run(
      `UPDATE members 
       SET name = ?, email = ?, phone = ?, member_type = ?, active = ?
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : existing.name,
        cleanEmail,
        phone !== undefined ? normalizePhone(phone) : existing.phone,
        member_type !== undefined ? member_type : existing.member_type,
        newActive,
        id
      ]
    );

    const updated = queryOne<Member>('SELECT * FROM members WHERE id = ?', [id]);
    res.json({ message: 'Member profile updated', member: updated });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member.' });
  }
});

// PATCH /api/members/:id/status
app.patch('/api/members/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<Member>('SELECT * FROM members WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const newStatus = existing.active === 1 ? 0 : 1;
    run('UPDATE members SET active = ? WHERE id = ?', [newStatus, id]);

    res.json({ 
      message: `Member status updated to ${newStatus === 1 ? 'Active' : 'Inactive'}`, 
      active: newStatus 
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle member status.' });
  }
});

// ==========================================
// ISSUE & CIRCULATION ROUTES
// ==========================================

// POST /api/issues (Enforces all business rules atomic)
app.post('/api/issues', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { book_id, member_id, issue_date } = req.body;
    if (!book_id || !member_id) {
      res.status(400).json({ error: 'Both Book ID and Member ID are required to issue a book.' });
      return;
    }

    const bId = Number(book_id);
    const mId = Number(member_id);

    // Validate eligibility
    const check = validateIssueEligibility(bId, mId, issue_date || getTodayStr());
    if (!check.allowed) {
      res.status(400).json({ error: check.reason });
      return;
    }

    // Atomic transaction execution
    const issue = issueBook(bId, mId, issue_date);
    res.status(201).json({
      message: `Book '${issue.book_title}' issued successfully. Due on ${issue.due_date}.`,
      issue
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to issue book';
    console.error('Issue book error:', message);
    res.status(400).json({ error: message });
  }
});

// GET /api/issues/check-eligibility
app.get('/api/issues/check-eligibility', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { book_id, member_id } = req.query;
    if (!book_id || !member_id) {
      res.status(400).json({ error: 'book_id and member_id are required' });
      return;
    }

    const check = validateIssueEligibility(Number(book_id), Number(member_id));
    res.json(check);
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ error: 'Eligibility check failed.' });
  }
});

// GET /api/issues
app.get('/api/issues', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, member_id, book_id, search, from_date, to_date } = req.query;
    const today = getTodayStr();

    let sql = `
      SELECT i.*, 
        b.title as book_title, b.isbn as book_isbn, b.author as book_author, b.category as book_category,
        m.name as member_name, m.member_code, m.email as member_email, m.phone as member_phone
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status && typeof status === 'string' && status !== 'All') {
      if (status === 'Overdue') {
        sql += ` AND i.status = 'Issued' AND i.due_date < ?`;
        params.push(today);
      } else {
        sql += ` AND i.status = ?`;
        params.push(status);
      }
    }

    if (member_id) {
      sql += ` AND i.member_id = ?`;
      params.push(Number(member_id));
    }

    if (book_id) {
      sql += ` AND i.book_id = ?`;
      params.push(Number(book_id));
    }

    if (from_date && typeof from_date === 'string') {
      sql += ` AND i.issue_date >= ?`;
      params.push(from_date);
    }

    if (to_date && typeof to_date === 'string') {
      sql += ` AND i.issue_date <= ?`;
      params.push(to_date);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(b.title) LIKE ? OR LOWER(b.isbn) LIKE ? OR LOWER(m.name) LIKE ? OR LOWER(m.member_code) LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY i.id DESC';
    const issues = query<IssueTransaction>(sql, params);

    const augmented = issues.map(issue => {
      if (issue.status === 'Issued') {
        const isOverdue = today > issue.due_date;
        const daysLate = Math.max(0, getDaysDiff(issue.due_date, today));
        return {
          ...issue,
          is_overdue: isOverdue,
          days_late: daysLate,
          fine_so_far: daysLate * 2
        };
      }
      return {
        ...issue,
        is_overdue: false,
        days_late: 0,
        fine_so_far: 0
      };
    });

    res.json({ issues: augmented });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ error: 'Failed to load transaction history.' });
  }
});

// GET /api/issues/:id
app.get('/api/issues/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const issue = queryOne<IssueTransaction>(`
      SELECT i.*, 
        b.title as book_title, b.isbn as book_isbn, b.author as book_author, b.category as book_category,
        m.name as member_name, m.member_code, m.email as member_email, m.phone as member_phone
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      WHERE i.id = ?
    `, [id]);

    if (!issue) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const today = getTodayStr();
    const daysLate = issue.status === 'Issued' ? Math.max(0, getDaysDiff(issue.due_date, today)) : 0;

    res.json({
      issue: {
        ...issue,
        is_overdue: issue.status === 'Issued' && today > issue.due_date,
        days_late: daysLate,
        fine_so_far: daysLate * 2
      }
    });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ error: 'Failed to retrieve transaction.' });
  }
});

// POST /api/issues/:id/return (Atomic, computes fine, prevents double return)
app.post('/api/issues/:id/return', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { return_date } = req.body;

    const result = returnBook(id, return_date);
    res.json({
      message: result.fine > 0 
        ? `Book returned successfully. Late by ${result.lateDays} days. Fine calculated: ₹${result.fine}.`
        : 'Book returned successfully with zero fine.',
      ...result
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Return operation failed';
    console.error('Return book error:', message);
    res.status(400).json({ error: message });
  }
});

// ==========================================
// REPORTS & CSV EXPORT ROUTES
// ==========================================

// GET /api/reports/overdue
app.get('/api/reports/overdue', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const today = getTodayStr();
    const rows = query<IssueTransaction>(`
      SELECT i.id, i.due_date, i.issue_date,
        b.title as book_title, b.isbn as book_isbn, b.author as book_author,
        m.name as member_name, m.member_code, m.phone as member_phone, m.email as member_email
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      WHERE i.status = 'Issued' AND i.due_date < ?
      ORDER BY i.due_date ASC
    `, [today]);

    const report = rows.map(r => {
      const daysLate = Math.max(0, getDaysDiff(r.due_date, today));
      const fineSoFar = daysLate * 2;
      return {
        ...r,
        days_late: daysLate,
        fine_so_far: fineSoFar
      };
    });

    res.json({ overdue: report });
  } catch (error) {
    console.error('Overdue report error:', error);
    res.status(500).json({ error: 'Failed to generate overdue report.' });
  }
});

// GET /api/reports/most-borrowed
app.get('/api/reports/most-borrowed', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = query<{
      id: number;
      title: string;
      author: string;
      category: string;
      borrow_count: number;
      total_copies: number;
      available_copies: number;
    }>(`
      SELECT b.id, b.title, b.author, b.category, b.total_copies, b.available_copies,
             COUNT(i.id) as borrow_count
      FROM books b
      LEFT JOIN issues i ON i.book_id = b.id
      GROUP BY b.id
      ORDER BY borrow_count DESC, b.title ASC
    `);

    res.json({ mostBorrowed: rows });
  } catch (error) {
    console.error('Most borrowed report error:', error);
    res.status(500).json({ error: 'Failed to generate most borrowed books report.' });
  }
});

// GET /api/reports/transactions/export (CSV export)
app.get('/api/reports/transactions/export', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const transactions = query<IssueTransaction>(`
      SELECT i.id, i.issue_date, i.due_date, i.return_date, i.fine, i.status,
             b.title as book_title, b.isbn as book_isbn,
             m.name as member_name, m.member_code, m.phone as member_phone
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN members m ON m.id = i.member_id
      ORDER BY i.id ASC
    `);

    // Generate CSV string
    const headers = ['Issue ID', 'Book Title', 'ISBN', 'Member Code', 'Member Name', 'Issue Date', 'Due Date', 'Return Date', 'Fine (INR)', 'Status'];
    const rows = transactions.map(t => [
      t.id,
      `"${(t.book_title || '').replace(/"/g, '""')}"`,
      `"${t.book_isbn || ''}"`,
      `"${t.member_code || ''}"`,
      `"${(t.member_name || '').replace(/"/g, '""')}"`,
      t.issue_date,
      t.due_date,
      t.return_date || 'N/A',
      t.fine.toFixed(2),
      t.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="library-transactions-${getTodayStr()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export transaction history.' });
  }
});

// ==========================================
// STATIC FILES & VITE MIDDLEWARE
// ==========================================

if (!isProduction) {
  // Development mode: attach Vite dev server middleware
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Production mode: serve built assets from dist
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// Global 404 for unmatched API routes
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API resource not found.' });
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// Start listener
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[LMS Full-Stack Server] Running on http://0.0.0.0:${PORT} (Node ${process.version})`);
});

export default app;
