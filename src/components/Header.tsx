import React from 'react';
import { Menu, Bell, BookCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobile: () => void;
  onQuickIssue: () => void;
  overdueCount: number;
  onViewOverdue: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobile,
  onQuickIssue,
  overdueCount,
  onViewOverdue,
}) => {
  const { user } = useAuth();

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Circulation Dashboard', subtitle: 'Live branch metrics & activity' },
    books: { title: 'Books Catalog', subtitle: 'Inventory inventory & copy allocation' },
    members: { title: 'Member Directory', subtitle: 'Students, faculty & staff cardholders' },
    issue: { title: 'Issue Book', subtitle: 'Validate borrowing eligibility & dispatch loan' },
    transactions: { title: 'Transactions Ledger', subtitle: 'Circulation history & fine settlement' },
    reports: { title: 'Library Reports', subtitle: 'Overdue notices, popular titles & ledger CSV' },
  };

  const currentInfo = titles[currentTab] || { title: 'Library System', subtitle: 'Staff Portal' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger + View Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-tight">
            {currentInfo.title}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick Actions, Overdue Bell, User Role */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Overdue Notification Bell */}
        <button
          onClick={onViewOverdue}
          title={overdueCount > 0 ? `${overdueCount} Overdue Loans` : 'No overdue loans'}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="View overdue books"
        >
          <Bell className="w-4 h-4" />
          {overdueCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center font-mono tabular-nums">
              {overdueCount}
            </span>
          )}
        </button>

        {/* Quick Issue CTA */}
        {currentTab !== 'issue' && (
          <button
            onClick={onQuickIssue}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <BookCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Issue Book</span>
          </button>
        )}

        {/* User Role Tag */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <div className="text-right hidden sm:block">
            <span className="font-medium text-slate-800 block capitalize">{user?.username}</span>
            <span className="text-[10px] text-slate-500 font-mono uppercase">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
