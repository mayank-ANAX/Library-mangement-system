/**
 * Centralized API client for Library Management System
 */

import { 
  User, 
  Book, 
  Member, 
  IssueTransaction, 
  DashboardData, 
  MostBorrowedBook 
} from '../types.ts';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('lms_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('lms_token', token);
    } else {
      localStorage.removeItem('lms_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('lms_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear token and notify app if session expired
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    if (!response.ok) {
      let errorMsg = 'An unexpected error occurred.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        errorMsg = `Server returned HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // --- Auth ---
  async login(username: string, password: string): Promise<{ token: string; user: User; message: string }> {
    const res = await this.request<{ token: string; user: User; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // --- Dashboard ---
  async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>('/dashboard');
  }

  // --- Books ---
  async getBooks(params?: { search?: string; category?: string; availability?: string }): Promise<{ books: Book[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.availability) query.set('availability', params.availability);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ books: Book[] }>(`/books${qs}`);
  }

  async getBook(id: number): Promise<{ book: Book; activeIssues?: IssueTransaction[] }> {
    return this.request<{ book: Book; activeIssues?: IssueTransaction[] }>(`/books/${id}`);
  }

  async createBook(data: Partial<Book>): Promise<{ message: string; book: Book }> {
    return this.request<{ message: string; book: Book }>('/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBook(id: number, data: Partial<Book>): Promise<{ message: string; book: Book }> {
    return this.request<{ message: string; book: Book }>(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBook(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/books/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Members ---
  async getMembers(params?: { search?: string; type?: string; status?: string }): Promise<{ members: Member[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ members: Member[] }>(`/members${qs}`);
  }

  async getMember(id: number): Promise<{ member: Member; activeLoans: IssueTransaction[]; history: IssueTransaction[] }> {
    return this.request<{ member: Member; activeLoans: IssueTransaction[]; history: IssueTransaction[] }>(`/members/${id}`);
  }

  async createMember(data: Partial<Member>): Promise<{ message: string; member: Member }> {
    return this.request<{ message: string; member: Member }>('/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMember(id: number, data: Partial<Member>): Promise<{ message: string; member: Member }> {
    return this.request<{ message: string; member: Member }>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleMemberStatus(id: number): Promise<{ message: string; active: number }> {
    return this.request<{ message: string; active: number }>(`/members/${id}/status`, {
      method: 'PATCH',
    });
  }

  // --- Issues & Circulation ---
  async checkEligibility(bookId: number, memberId: number): Promise<{ allowed: boolean; reason?: string }> {
    return this.request<{ allowed: boolean; reason?: string }>(
      `/issues/check-eligibility?book_id=${bookId}&member_id=${memberId}`
    );
  }

  async issueBook(bookId: number, memberId: number, issueDate?: string): Promise<{ message: string; issue: IssueTransaction }> {
    return this.request<{ message: string; issue: IssueTransaction }>('/issues', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, member_id: memberId, issue_date: issueDate }),
    });
  }

  async getIssues(params?: { status?: string; search?: string; member_id?: number; book_id?: number }): Promise<{ issues: IssueTransaction[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.member_id) query.set('member_id', String(params.member_id));
    if (params?.book_id) query.set('book_id', String(params.book_id));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ issues: IssueTransaction[] }>(`/issues${qs}`);
  }

  async returnBook(issueId: number, returnDate?: string): Promise<{ message: string; issue: IssueTransaction; lateDays: number; fine: number }> {
    return this.request<{ message: string; issue: IssueTransaction; lateDays: number; fine: number }>(`/issues/${issueId}/return`, {
      method: 'POST',
      body: JSON.stringify({ return_date: returnDate }),
    });
  }

  // --- Reports ---
  async getOverdueReport(): Promise<{ overdue: IssueTransaction[] }> {
    return this.request<{ overdue: IssueTransaction[] }>('/reports/overdue');
  }

  async getMostBorrowedReport(): Promise<{ mostBorrowed: MostBorrowedBook[] }> {
    return this.request<{ mostBorrowed: MostBorrowedBook[] }>('/reports/most-borrowed');
  }

  async downloadTransactionsCSV(): Promise<void> {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/reports/transactions/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to export CSV report');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library-circulation-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export const api = new ApiService();
