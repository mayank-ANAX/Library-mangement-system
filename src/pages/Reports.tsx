import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  AlertTriangle, 
  TrendingUp, 
  Table, 
  RotateCcw,
  BookOpen,
  IndianRupee,
  Phone,
  Bookmark
} from 'lucide-react';
import { api } from '../services/api.ts';
import { IssueTransaction, MostBorrowedBook } from '../types.ts';

interface ReportsProps {
  onInitiateReturn: (issue: IssueTransaction) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onInitiateReturn, showToast }) => {
  const [activeReport, setActiveReport] = useState<'overdue' | 'most_borrowed' | 'ledger'>('overdue');

  const [overdueList, setOverdueList] = useState<IssueTransaction[]>([]);
  const [mostBorrowedList, setMostBorrowedList] = useState<MostBorrowedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [overdueRes, mostRes] = await Promise.all([
        api.getOverdueReport(),
        api.getMostBorrowedReport(),
      ]);
      setOverdueList(overdueRes.overdue);
      setMostBorrowedList(mostRes.mostBorrowed);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleExportCSV = async () => {
    setDownloading(true);
    try {
      await api.downloadTransactionsCSV();
      showToast('success', 'Circulation ledger CSV downloaded successfully.');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to export CSV report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Reports & Auditing
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit overdue loans, patron popularity rankings, and export circulation history to CSV
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadReports}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{downloading ? 'Exporting...' : 'Export CSV Ledger'}</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveReport('overdue')}
          className={`pb-3 px-2 text-xs font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeReport === 'overdue'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Report 1: Overdue Books ({overdueList.length})</span>
        </button>

        <button
          onClick={() => setActiveReport('most_borrowed')}
          className={`pb-3 px-2 text-xs font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeReport === 'most_borrowed'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span>Report 2: Most Borrowed Books</span>
        </button>

        <button
          onClick={() => setActiveReport('ledger')}
          className={`pb-3 px-2 text-xs font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeReport === 'ledger'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Table className="w-3.5 h-3.5 text-slate-500" />
          <span>Report 3: Transaction CSV Ledger</span>
        </button>
      </div>

      {/* REPORT 1: OVERDUE BOOKS */}
      {activeReport === 'overdue' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Overdue Loans Audit List
              </h3>
              <p className="text-xs text-slate-500">
                Titles exceeding the 14-day borrowing threshold incurring fine at ₹2.00 / day
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
              {overdueList.length} Overdue Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-medium">
                  <th className="py-3 px-4">Book Title & Author</th>
                  <th className="py-3 px-4">Borrower Name</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Days Late</th>
                  <th className="py-3 px-4 text-right">Fine So Far</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Compiling overdue report...
                    </td>
                  </tr>
                ) : overdueList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <p className="text-sm font-medium text-slate-900">No overdue loans</p>
                      <p className="text-xs text-slate-500 mt-1">All circulating volumes are currently in good standing.</p>
                    </td>
                  </tr>
                ) : (
                  overdueList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.book_title}</div>
                        <div className="text-slate-500 text-[11px]">{item.book_author} · <span className="font-mono">{item.book_isbn}</span></div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">{item.member_name}</span>
                        <span className="text-slate-400 font-mono text-[11px] block">{item.member_code}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.member_phone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-rose-600 font-semibold">
                        {item.due_date}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                        {item.days_late} days
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm">
                        ₹{item.fine_so_far?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onInitiateReturn(item)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium cursor-pointer"
                        >
                          Check In & Collect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: MOST BORROWED BOOKS */}
      {activeReport === 'most_borrowed' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Most Borrowed Titles Leaderboard
              </h3>
              <p className="text-xs text-slate-500">
                Ranking of highest demand books across all checkout cycles
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-medium">
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Book Title</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Circulation Count</th>
                  <th className="py-3 px-4 text-center">Inventory Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Compiling borrowing leaderboard...
                    </td>
                  </tr>
                ) : mostBorrowedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No circulation data recorded yet.
                    </td>
                  </tr>
                ) : (
                  mostBorrowedList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.title}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.author}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                          <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.borrow_count} checkouts</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {item.available_copies} avail / {item.total_copies} total
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: TRANSACTION REPORT / CSV EXPORT */}
      {activeReport === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="max-w-xl space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Full Circulation Audit Ledger (CSV)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Export the complete relational history of all issued and returned book transactions including borrower identifiers, timestamps, due dates, return dates, and fine values.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <span className="font-semibold text-slate-900 block">Exported CSV Schema Columns:</span>
              <p className="font-mono text-slate-600 text-[11px] leading-relaxed">
                Issue ID, Book Title, ISBN, Member Code, Member Name, Issue Date, Due Date, Return Date, Fine (INR), Status
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{downloading ? 'Generating CSV File...' : 'Download Complete Circulation Ledger (CSV)'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
