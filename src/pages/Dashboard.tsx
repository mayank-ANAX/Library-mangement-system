import React, { useEffect, useState } from 'react';
import { 
  BookOpen, 
  Layers, 
  CheckCircle, 
  Clock, 
  Users, 
  AlertTriangle, 
  IndianRupee, 
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  Bookmark
} from 'lucide-react';
import { api } from '../services/api.ts';
import { DashboardData, IssueTransaction } from '../types.ts';
import { NavTab } from '../components/Sidebar.tsx';

interface DashboardProps {
  onNavigate: (tab: NavTab) => void;
  onInitiateReturn: (issue: IssueTransaction) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onInitiateReturn }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 bg-slate-100 rounded-xl lg:col-span-2" />
          <div className="h-72 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Failed to Load Dashboard</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const { stats, recentTransactions, overdueAlerts, mostBorrowed, categories, memberTypes } = data;

  // Stat Cards Config
  const statCards = [
    { label: 'Total Titles', value: stats.totalTitles, icon: BookOpen, color: 'text-slate-900', sub: 'Cataloged books' },
    { label: 'Total Copies', value: stats.totalCopies, icon: Layers, color: 'text-slate-900', sub: 'Physical inventory' },
    { label: 'Available Copies', value: stats.availableCopies, icon: CheckCircle, color: 'text-emerald-600', sub: 'Ready on shelves' },
    { label: 'Issued Books', value: stats.issuedBooks, icon: Clock, color: 'text-amber-600', sub: 'Active circulation' },
    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-slate-900', sub: 'Registered patrons' },
    { label: 'Active Members', value: stats.activeMembers, icon: Users, color: 'text-emerald-600', sub: 'In good standing' },
    { label: 'Overdue Loans', value: stats.overdueBooks, icon: AlertTriangle, color: 'text-rose-600', sub: 'Require recall/fines' },
    { label: 'Total Fines', value: `₹${stats.totalFines.toFixed(0)}`, icon: IndianRupee, color: 'text-amber-700', sub: `₹${stats.collectedFines.toFixed(0)} settled` },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Circulation Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Single-branch real-time library operations ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate('issue')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <span>Issue New Book</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 8 Metric Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium text-slate-600 truncate">{c.label}</span>
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
              <div>
                <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${c.color}`}>
                  {c.value}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 truncate">{c.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Circulation Ratio Gauge / Visual Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Book Circulation Distribution
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {stats.totalCopies} Copies
              </span>
            </div>

            {/* Proportional Segmented Bar */}
            <div className="h-4 w-full bg-slate-100 rounded-md overflow-hidden flex mb-4">
              <div
                style={{ width: `${stats.totalCopies > 0 ? (stats.availableCopies / stats.totalCopies) * 100 : 0}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Available: ${stats.availableCopies}`}
              />
              <div
                style={{ width: `${stats.totalCopies > 0 ? (stats.issuedBooks / stats.totalCopies) * 100 : 0}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`Issued: ${stats.issuedBooks}`}
              />
            </div>

            {/* Legend with Unboxed Metadata */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  <span className="text-slate-600 font-medium">Available Copies</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {stats.availableCopies} ({stats.totalCopies > 0 ? Math.round((stats.availableCopies / stats.totalCopies) * 100) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span className="text-slate-600 font-medium">Currently Issued</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {stats.issuedBooks} ({stats.totalCopies > 0 ? Math.round((stats.issuedBooks / stats.totalCopies) * 100) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                  <span className="text-slate-600 font-medium">Overdue (Included in Issued)</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-rose-600">
                  {stats.overdueBooks}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Branch Loan Period</span>
            <span className="font-semibold text-slate-900">14 Days Standard</span>
          </div>
        </div>

        {/* Categories Bar Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Catalog by Category
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {categories.length} Categories
              </span>
            </div>

            <div className="space-y-3.5">
              {categories.slice(0, 5).map((cat, idx) => {
                const maxCopies = Math.max(...categories.map((c) => c.total_copies), 1);
                const percent = Math.min(100, Math.round((cat.total_copies / maxCopies) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[180px]">
                        {cat.category}
                      </span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        {cat.book_count} titles · {cat.total_copies} copies
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full bg-slate-700 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Primary Focus</span>
            <span className="font-medium text-slate-900">Academic & Technology</span>
          </div>
        </div>

        {/* Member Types & Fine Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Membership Composition
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {stats.totalMembers} Cardholders
              </span>
            </div>

            <div className="space-y-3 text-xs mb-6">
              {memberTypes.map((mt, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-medium text-slate-700">{mt.member_type}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums font-semibold text-slate-900">{mt.count}</span>
                    <span className="text-slate-400 text-[11px]">
                      ({stats.totalMembers > 0 ? Math.round((mt.count / stats.totalMembers) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Fine Overview Box */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                <span>Fine Policy</span>
                <span className="font-mono">₹2.00 / day</span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1 leading-normal">
                Overdue fines accrue automatically after the 14-day threshold until the book is checked in.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Active Cardholders</span>
            <span className="font-semibold text-emerald-600 font-mono tabular-nums">
              {stats.activeMembers} Active
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Overdue Alerts & Most Borrowed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Alerts Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Overdue Book Alerts ({overdueAlerts.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Full Report</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {overdueAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No overdue loans currently active. All circulation is within the 14-day window.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdueAlerts.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {o.book_title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{o.member_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{o.member_phone}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-600 font-medium">Due {o.due_date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-rose-600 block">
                        ₹{o.fine_so_far} fine
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {o.days_late}d late
                      </span>
                    </div>

                    <button
                      onClick={() => onInitiateReturn(o)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors"
                    >
                      Return
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Borrowed Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Most Borrowed Titles
              </h3>
            </div>
            <button
              onClick={() => onNavigate('books')}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Catalog</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {mostBorrowed.map((b, idx) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-400 w-4 text-right">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {b.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {b.author} · <span className="text-slate-400">{b.category}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    <Bookmark className="w-3 h-3 text-emerald-600" />
                    {b.borrow_count} loans
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Recent Circulation Activity
          </h3>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All Transactions</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="pb-2.5 font-medium">Issue ID</th>
                <th className="pb-2.5 font-medium">Book Title</th>
                <th className="pb-2.5 font-medium">Member</th>
                <th className="pb-2.5 font-medium">Issue Date</th>
                <th className="pb-2.5 font-medium">Due Date</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 font-mono text-slate-500">#{tx.id}</td>
                  <td className="py-2.5 font-medium text-slate-900 max-w-[200px] truncate">
                    {tx.book_title}
                  </td>
                  <td className="py-2.5 text-slate-600">
                    {tx.member_name} <span className="text-slate-400 font-mono text-[11px]">({tx.member_code})</span>
                  </td>
                  <td className="py-2.5 font-mono text-slate-500">{tx.issue_date}</td>
                  <td className="py-2.5 font-mono text-slate-500">{tx.due_date}</td>
                  <td className="py-2.5">
                    {tx.status === 'Returned' ? (
                      <span className="text-emerald-700 font-medium">Returned</span>
                    ) : (
                      <span className="text-amber-700 font-medium">Issued</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {tx.status === 'Issued' ? (
                      <button
                        onClick={() => onInitiateReturn(tx)}
                        className="px-2 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded transition-colors"
                      >
                        Return
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
