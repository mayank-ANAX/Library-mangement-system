/**
 * Shared Type Definitions for LMS Frontend
 */

export type UserRole = 'admin' | 'librarian';

export interface User {
  id: number;
  username: string;
  role: UserRole;
}

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  category: string;
  total_copies: number;
  available_copies: number;
  issued_copies?: number;
  status?: 'Available' | 'Partially Available' | 'Unavailable';
  can_delete?: boolean;
  cannot_delete_reason?: string;
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
  active: boolean | number;
  active_loans_count?: number;
  has_overdue?: boolean;
  remaining_capacity?: number;
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
  book_category?: string;
  member_name?: string;
  member_code?: string;
  member_email?: string;
  member_phone?: string;
  member_type?: string;
  is_overdue?: boolean;
  days_late?: number;
  fine_so_far?: number;
}

export interface DashboardStats {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedBooks: number;
  returnedBooks: number;
  totalMembers: number;
  activeMembers: number;
  overdueBooks: number;
  collectedFines: number;
  pendingFines: number;
  totalFines: number;
}

export interface CategoryMetric {
  category: string;
  book_count: number;
  total_copies: number;
}

export interface MemberTypeMetric {
  member_type: string;
  count: number;
}

export interface MostBorrowedBook {
  id: number;
  title: string;
  author: string;
  category: string;
  borrow_count: number;
  total_copies?: number;
  available_copies?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentTransactions: IssueTransaction[];
  overdueAlerts: IssueTransaction[];
  mostBorrowed: MostBorrowedBook[];
  categories: CategoryMetric[];
  memberTypes: MemberTypeMetric[];
}
