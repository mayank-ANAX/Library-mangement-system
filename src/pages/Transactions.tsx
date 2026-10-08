import React, { useState, useEffect, useTransition } from 'react';
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  IndianRupee, 
  X,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api.ts';
import { IssueTransaction } from '../types.ts';

interface TransactionsProps {
  initialReturnIssue?: IssueTransaction | null;
  onClearInitialReturn?: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({
  initialReturnIssue,
  onClearInitialReturn,
  showToast,
}) => {
  const [, startTransition] = useTransition();

  const [issues, setIssues] = useState<IssueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Return modal state
  const [returnTarget, setReturnTarget] = useState<IssueTransaction | null>(initialReturnIssue || null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [returnDate, setReturnDate] = useState<string>(todayStr);
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    if (initialReturnIssue) {
      setReturnTarget(initialReturnIssue);
    }
  }, [initialReturnIssue]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getIssues({
        search: searchTerm,
        status: selectedStatus,
      });
      setIssues(res.issues);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedStatus]);

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        loadTransactions();
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Compute live fine preview for modal
  const computeFinePreview = (dueDateStr?: string, retDateStr?: string) => {
    if (!dueDateStr || !retDateStr) return { lateDays: 0, fine: 0 };
    try {
      const d1 = new Date(dueDateStr);
      const d2 = new Date(retDateStr);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const lateDays = Math.max(0, diffDays);
      return { lateDays, fine: lateDays * 2 };
    } catch {
      return { lateDays: 0, fine: 0 };
    }
  };

  const preview = returnTarget ? computeFinePreview(returnTarget.due_date, returnDate) : { lateDays: 0, fine: 0 };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;

    setSubmittingReturn(true);
    try {
      const res = await api.returnBook(returnTarget.id, returnDate);
      showToast('success', res.message);
      setReturnTarget(null);
      if (onClearInitialReturn) onClearInitialReturn();
      loadTransactions();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to return book');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Circulation Transactions Ledger
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit book loan history, due dates, returns, and overdue fine settlements
          </p>
        </div>

        <button
          onClick={loadTransactions}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Title, Member name/code, ISBN, Issue ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="All">All Transactions</option>
            <option value="Issued">Active Loans (Issued)</option>
            <option value="Overdue">Overdue Only</option>
            <option value="Returned">Completed Returns</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Issue ID</th>
                <th className="py-3 px-4">Book Title & ISBN</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Return Date</th>
                <th className="py-3 px-4 text-right">Fine</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading transactions ledger...
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">No transactions recorded</p>
                    <p className="text-xs text-slate-500 mt-1">Issue books to cardholders to populate circulation data.</p>
                  </td>
                </tr>
              ) : (
                issues.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">
                      #{tx.id}
                    </td>
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-semibold text-slate-900 truncate">{tx.book_title}</div>
                      <div className="text-slate-500 font-mono text-[11px] truncate">
                        ISBN: {tx.book_isbn}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tx.member_name}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {tx.member_code} · {tx.member_phone}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {tx.issue_date}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      <span className={tx.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        {tx.due_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {tx.return_date || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold">
                      {tx.status === 'Returned' ? (
                        tx.fine > 0 ? (
                          <span className="text-rose-600">₹{tx.fine.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">₹0.00</span>
                        )
                      ) : tx.is_overdue ? (
                        <span className="text-rose-600" title="Accrued fine so far">
                          ₹{tx.fine_so_far?.toFixed(2)}*
                        </span>
                      ) : (
                        <span className="text-slate-400">₹0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.status === 'Returned' && (
                        <span className="text-emerald-700 font-medium">Returned</span>
                      )}
                      {tx.status === 'Issued' && !tx.is_overdue && (
                        <span className="text-amber-700 font-medium">Issued</span>
                      )}
                      {tx.status === 'Issued' && tx.is_overdue && (
                        <span className="text-rose-700 font-bold">Overdue ({tx.days_late}d)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {tx.status === 'Issued' ? (
                        <button
                          onClick={() => setReturnTarget(tx)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Return Book
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">Closed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Book Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Process Book Return
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Transaction #{returnTarget.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setReturnTarget(null);
                  if (onClearInitialReturn) onClearInitialReturn();
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              {/* Target info */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Book Title</span>
                  <span className="font-semibold text-slate-900 text-sm">{returnTarget.book_title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Cardholder</span>
                    <span className="font-medium text-slate-900">{returnTarget.member_name} ({returnTarget.member_code})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Scheduled Due Date</span>
                    <span className="font-mono font-medium text-slate-900">{returnTarget.due_date}</span>
                  </div>
                </div>
              </div>

              {/* Return Date Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Actual Return Date
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Live Fine Calculation Preview */}
              <div className={`p-4 rounded-xl border text-xs ${
                preview.fine > 0 
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold">Calculated Late Fine:</span>
                  <span className="font-mono font-bold text-base">
                    ₹{preview.fine.toFixed(2)}
                  </span>
                </div>

                {preview.fine > 0 ? (
                  <p className="text-[11px] leading-relaxed">
                    Overdue by <strong>{preview.lateDays} days</strong> (due on {returnTarget.due_date}). Late penalty rate is ₹2.00 per day.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed">
                    Returned on or before due date. Zero overdue fines applicable.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReturnTarget(null);
                    if (onClearInitialReturn) onClearInitialReturn();
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingReturn ? 'Processing...' : 'Confirm Return & Restore Copy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
