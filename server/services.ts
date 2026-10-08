/**
 * Core Library Business Rules and Services
 */

import { query, queryOne, run, transaction } from './db.ts';

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  category: string;
  total_copies: number;
  available_copies: number;
  created_at?: string;
  updated_at?: string;
}

export interface Member {
  id: number;
  member_code: string;
  name: string;
  email: string;
  phone: string;
  member_type: 'Student' | 'Faculty' | 'Staff';
  joined_on: string;
  active: number;
  created_at?: string;
  active_loans_count?: number;
  has_overdue?: boolean;
}

export interface IssueTransaction {
  id: number;
  book_id: number;
  member_id: number;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  fine: number;
  status: 'Issued' | 'Returned';
  book_title?: string;
  book_isbn?: string;
  book_author?: string;
  member_name?: string;
  member_code?: string;
  member_email?: string;
  member_phone?: string;
  member_type?: string;
  days_late?: number;
  fine_so_far?: number;
}

/**
 * Format Date as YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current system date in YYYY-MM-DD format
 */
export function getTodayStr(): string {
  return formatDate(new Date());
}

/**
 * Add days to YYYY-MM-DD string
 */
export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Calculate calendar days difference: (dateB - dateA)
 */
export function getDaysDiff(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * Calculate fine for an issue given return date or current date
 * ₹2 per day after due date
 */
export function calculateFine(dueDateStr: string, returnDateStr: string): { lateDays: number; fine: number } {
  const lateDays = Math.max(0, getDaysDiff(dueDateStr, returnDateStr));
  const fine = lateDays * 2;
  return { lateDays, fine };
}

/**
 * Check if a member has any overdue books as of today
 */
export function memberHasOverdue(memberId: number, asOfDate = getTodayStr()): boolean {
  const rows = query<{ count: number }>(
    `SELECT COUNT(*) as count FROM issues 
     WHERE member_id = ? AND status = 'Issued' AND due_date < ?`,
    [memberId, asOfDate]
  );
  return (rows[0]?.count ?? 0) > 0;
}

/**
 * Get active issue count for member
 */
export function getMemberActiveLoanCount(memberId: number): number {
  const rows = query<{ count: number }>(
    `SELECT COUNT(*) as count FROM issues WHERE member_id = ? AND status = 'Issued'`,
    [memberId]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Validate book issue eligibility against all 5 core business rules
 */
export function validateIssueEligibility(bookId: number, memberId: number, asOfDate = getTodayStr()): {
  allowed: boolean;
  reason?: string;
  book?: Book;
  member?: Member;
} {
  const book = queryOne<Book>('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book) {
    return { allowed: false, reason: 'Book not found' };
  }

  const member = queryOne<Member>('SELECT * FROM members WHERE id = ?', [memberId]);
  if (!member) {
    return { allowed: false, reason: 'Member not found' };
  }

  // Rule 5: Inactive members cannot borrow books
  if (!member.active) {
    return { allowed: false, reason: 'Member account is inactive. Inactive members cannot borrow books.', book, member };
  }

  // Rule 1: A book cannot be issued if available_copies < 1
  if (book.available_copies < 1) {
    return { allowed: false, reason: 'No copies available for this book.', book, member };
  }

  // Rule 4: A member with any overdue book cannot issue another book
  if (memberHasOverdue(memberId, asOfDate)) {
    return { allowed: false, reason: 'Member has overdue books. Overdue accounts cannot borrow additional books until returns are settled.', book, member };
  }

  // Rule 3: A member cannot borrow more than 3 active books
  const activeLoans = getMemberActiveLoanCount(memberId);
  if (activeLoans >= 3) {
    return { allowed: false, reason: 'Borrowing limit reached. A member cannot hold more than 3 active books simultaneously.', book, member };
  }

  // Rule 2: A member cannot hold the same book/title twice simultaneously
  const duplicateHolding = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM issues 
     WHERE member_id = ? AND book_id = ? AND status = 'Issued'`,
    [memberId, bookId]
  );
  if ((duplicateHolding?.count ?? 0) > 0) {
    return { allowed: false, reason: 'Member already currently holds an issued copy of this book.', book, member };
  }

  return { allowed: true, book, member };
}

/**
 * Issue a book atomically
 */
export function issueBook(bookId: number, memberId: number, customIssueDate?: string): IssueTransaction {
  const issueDate = customIssueDate || getTodayStr();
  const dueDate = addDays(issueDate, 14); // 14 days loan period

  return transaction(() => {
    // Re-verify eligibility inside the transaction
    const check = validateIssueEligibility(bookId, memberId, issueDate);
    if (!check.allowed) {
      throw new Error(check.reason || 'Issue eligibility check failed');
    }

    // 1. Decrement available copies
    run(
      'UPDATE books SET available_copies = available_copies - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [bookId]
    );

    // 2. Create issue record
    const insertResult = run(
      `INSERT INTO issues (book_id, member_id, issue_date, due_date, return_date, fine, status) 
       VALUES (?, ?, ?, ?, NULL, 0, 'Issued')`,
      [bookId, memberId, issueDate, dueDate]
    );

    const issue = queryOne<IssueTransaction>(
      `SELECT i.*, b.title as book_title, b.isbn as book_isbn, b.author as book_author,
              m.name as member_name, m.member_code, m.email as member_email
       FROM issues i
       JOIN books b ON b.id = i.book_id
       JOIN members m ON m.id = i.member_id
       WHERE i.id = ?`,
      [insertResult.lastInsertRowid]
    );

    if (!issue) {
      throw new Error('Failed to retrieve created issue record');
    }

    return issue;
  });
}

/**
 * Return a book atomically and compute fines
 */
export function returnBook(issueId: number, customReturnDate?: string): {
  issue: IssueTransaction;
  lateDays: number;
  fine: number;
} {
  const returnDate = customReturnDate || getTodayStr();

  return transaction(() => {
    const existing = queryOne<IssueTransaction>('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    // Prevent double return
    if (existing.status === 'Returned') {
      throw new Error('This book has already been returned.');
    }

    // Calculate fine: late_days = max(0, return_date - due_date) * 2
    const { lateDays, fine } = calculateFine(existing.due_date, returnDate);

    // 1. Update issue record
    run(
      `UPDATE issues SET status = 'Returned', return_date = ?, fine = ? WHERE id = ?`,
      [returnDate, fine, issueId]
    );

    // 2. Increment book available copies
    run(
      'UPDATE books SET available_copies = available_copies + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [existing.book_id]
    );

    const updated = queryOne<IssueTransaction>(
      `SELECT i.*, b.title as book_title, b.isbn as book_isbn, b.author as book_author,
              m.name as member_name, m.member_code, m.email as member_email
       FROM issues i
       JOIN books b ON b.id = i.book_id
       JOIN members m ON m.id = i.member_id
       WHERE i.id = ?`,
      [issueId]
    );

    if (!updated) {
      throw new Error('Failed to retrieve updated issue record');
    }

    return { issue: updated, lateDays, fine };
  });
}

/**
 * Check if book can be deleted (No transaction history)
 */
export function canDeleteBook(bookId: number): { allowed: boolean; reason?: string } {
  const issueCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM issues WHERE book_id = ?',
    [bookId]
  );
  if ((issueCount?.count ?? 0) > 0) {
    return {
      allowed: false,
      reason: 'Book cannot be deleted because circulation and issue history exists for this title.'
    };
  }
  return { allowed: true };
}

/**
 * Get current borrowed copies for a book
 */
export function getCurrentlyBorrowedCopies(bookId: number): number {
  const res = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM issues WHERE book_id = ? AND status = 'Issued'`,
    [bookId]
  );
  return res?.count ?? 0;
}
