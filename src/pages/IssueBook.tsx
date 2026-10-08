import React, { useState, useEffect } from 'react';
import { 
  BookCheck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Calendar, 
  ArrowRight,
  Sparkles,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Book, Member } from '../types.ts';
import { NavTab } from '../components/Sidebar.tsx';

interface IssueBookProps {
  preselectedBook?: Book | null;
  preselectedMember?: Member | null;
  onClearPreselections: () => void;
  onNavigate: (tab: NavTab) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const IssueBook: React.FC<IssueBookProps> = ({
  preselectedBook,
  preselectedMember,
  onClearPreselections,
  onNavigate,
  showToast,
}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected entities
  const [selectedBook, setSelectedBook] = useState<Book | null>(preselectedBook || null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(preselectedMember || null);

  // Member live profile (active loans, overdue status)
  const [memberProfile, setMemberProfile] = useState<{
    active_loans_count: number;
    has_overdue: boolean;
    remaining_capacity: number;
    heldBookIds: number[];
  } | null>(null);

  // Issue date
  const todayStr = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [submitting, setSubmitting] = useState(false);

  // Search filters
  const [bookSearch, setBookSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  // Calculate 14-day due date
  const computeDueDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + 14);
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const dueDate = computeDueDate(issueDate);

  // Load books & members
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [booksRes, membersRes] = await Promise.all([
          api.getBooks({ availability: 'All' }),
          api.getMembers({ status: 'All' }),
        ]);
        setBooks(booksRes.books);
        setMembers(membersRes.members);
      } catch (err: unknown) {
        showToast('error', err instanceof Error ? err.message : 'Failed to fetch catalog or members');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Update member details when a member is selected
  useEffect(() => {
    if (!selectedMember) {
      setMemberProfile(null);
      return;
    }

    const fetchMemberDetails = async () => {
      try {
        const res = await api.getMember(selectedMember.id);
        const heldBookIds = res.activeLoans.map((l) => l.book_id);
        setMemberProfile({
          active_loans_count: res.activeLoans.length,
          has_overdue: res.member.has_overdue || false,
          remaining_capacity: Math.max(0, 3 - res.activeLoans.length),
          heldBookIds,
        });
      } catch (err) {
        console.error('Failed to get member details:', err);
      }
    };

    fetchMemberDetails();
  }, [selectedMember]);

  // Eligibility Rule Checks
  const isBookAvailable = selectedBook ? selectedBook.available_copies > 0 : false;
  const isMemberActive = selectedMember ? !!selectedMember.active : false;
  const hasOverdueLoans = memberProfile ? memberProfile.has_overdue : false;
  const hasCapacity = memberProfile ? memberProfile.active_loans_count < 3 : false;
  const alreadyHoldsTitle = (selectedBook && memberProfile) ? memberProfile.heldBookIds.includes(selectedBook.id) : false;

  const isEligible = 
    selectedBook && 
    selectedMember && 
    memberProfile && 
    isBookAvailable && 
    isMemberActive && 
    !hasOverdueLoans && 
    hasCapacity && 
    !alreadyHoldsTitle;

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !selectedMember) {
      showToast('error', 'Please select both a book and a member.');
      return;
    }

    if (!isEligible) {
      showToast('error', 'Cannot issue book: One or more business rules violated.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.issueBook(selectedBook.id, selectedMember.id, issueDate);
      showToast('success', res.message);
      onClearPreselections();
      // Reset form
      setSelectedBook(null);
      setSelectedMember(null);
      setMemberProfile(null);
      // Navigate to transactions to see newly minted issue
      onNavigate('transactions');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to issue book');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.isbn.includes(bookSearch) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.member_code.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.phone.includes(memberSearch)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Issue Book Terminal
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Select cardholder and title to verify real-time loan eligibility against library rules
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Member Selection */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Step 1 · Cardholder
              </span>
              {selectedMember && (
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 underline"
                >
                  Change
                </button>
              )}
            </div>

            {selectedMember ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">
                      {selectedMember.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedMember.member_code} · {selectedMember.member_type}
                    </p>
                  </div>
                  <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>

                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200/60">
                  <p>Email: <span className="font-medium text-slate-900">{selectedMember.email}</span></p>
                  <p>Phone: <span className="font-mono text-slate-900">{selectedMember.phone}</span></p>
                </div>

                {memberProfile && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[11px]">Active Loans</span>
                      <span className="font-mono font-bold text-slate-900">{memberProfile.active_loans_count} / 3</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[11px]">Capacity</span>
                      <span className="font-mono font-bold text-emerald-600">{memberProfile.remaining_capacity} left</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search member by name, code, phone..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMember(m)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-emerald-700">
                          {m.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {m.member_code} · {m.member_type} · {m.phone}
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 leading-normal">
            Members can hold a maximum of 3 concurrent loans and cannot hold active overdue titles.
          </p>
        </div>

        {/* Step 2: Book Selection */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Step 2 · Book Title
              </span>
              {selectedBook && (
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 underline"
                >
                  Change
                </button>
              )}
            </div>

            {selectedBook ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">
                      {selectedBook.title}
                    </h4>
                    <p className="text-xs text-slate-500">
                      by {selectedBook.author}
                    </p>
                  </div>
                  <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>

                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200/60 font-mono">
                  <p>ISBN: <span className="font-medium text-slate-900">{selectedBook.isbn}</span></p>
                  <p>Category: <span className="font-sans font-medium text-slate-900">{selectedBook.category}</span></p>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-100 text-center">
                  <span className="text-slate-400 block text-[11px]">Available Inventory</span>
                  <span className={`font-mono font-bold text-base ${
                    selectedBook.available_copies > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {selectedBook.available_copies} of {selectedBook.total_copies} Copies Available
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Search by title, ISBN, author..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {filteredBooks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBook(b)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-emerald-700">
                          {b.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {b.author} · <span className="font-mono">{b.isbn}</span>
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        b.available_copies > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {b.available_copies} avail
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 leading-normal">
            Only titles with available copies &gt; 0 can be checked out.
          </p>
        </div>

        {/* Step 3: Verification & Execution */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <form onSubmit={handleIssueSubmit} className="space-y-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Step 3 · Eligibility Audit
            </span>

            {/* Business Rules Checklist */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <h4 className="font-semibold text-slate-900 mb-1">
                Core Policy Validation
              </h4>

              {/* Rule 1: Copies */}
              <div className="flex items-center gap-2">
                {selectedBook ? (
                  isBookAvailable ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 inline-block shrink-0" />
                )}
                <span className={!selectedBook ? 'text-slate-400' : isBookAvailable ? 'text-slate-700' : 'text-rose-700 font-medium'}>
                  Book has copies available (&gt; 0)
                </span>
              </div>

              {/* Rule 5: Active member */}
              <div className="flex items-center gap-2">
                {selectedMember ? (
                  isMemberActive ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 inline-block shrink-0" />
                )}
                <span className={!selectedMember ? 'text-slate-400' : isMemberActive ? 'text-slate-700' : 'text-rose-700 font-medium'}>
                  Member card is Active
                </span>
              </div>

              {/* Rule 3: Max 3 books */}
              <div className="flex items-center gap-2">
                {memberProfile ? (
                  hasCapacity ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 inline-block shrink-0" />
                )}
                <span className={!memberProfile ? 'text-slate-400' : hasCapacity ? 'text-slate-700' : 'text-rose-700 font-medium'}>
                  Borrowing limit not exceeded (&lt; 3 books)
                </span>
              </div>

              {/* Rule 4: No overdue */}
              <div className="flex items-center gap-2">
                {memberProfile ? (
                  !hasOverdueLoans ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 inline-block shrink-0" />
                )}
                <span className={!memberProfile ? 'text-slate-400' : !hasOverdueLoans ? 'text-slate-700' : 'text-rose-700 font-medium'}>
                  No active overdue loans on record
                </span>
              </div>

              {/* Rule 2: Not duplicate holding */}
              <div className="flex items-center gap-2">
                {selectedBook && memberProfile ? (
                  !alreadyHoldsTitle ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 inline-block shrink-0" />
                )}
                <span className={(!selectedBook || !memberProfile) ? 'text-slate-400' : !alreadyHoldsTitle ? 'text-slate-700' : 'text-rose-700 font-medium'}>
                  Member does not already hold this title
                </span>
              </div>
            </div>

            {/* Date settings & Due Date preview */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-950 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 block">Computed Due Date (14 Days)</span>
                  <span className="font-mono font-bold text-sm text-emerald-900">{dueDate}</span>
                </div>
                <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !isEligible}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <BookCheck className="w-4 h-4 text-emerald-400" />
              <span>{submitting ? 'Executing Loan...' : 'Authorize & Issue Book'}</span>
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-3">
            Issuing atomically decrements available copies and writes a circulation ledger record.
          </p>
        </div>
      </div>
    </div>
  );
};
