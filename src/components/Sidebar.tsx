import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  ArrowRightLeft, 
  FileText, 
  BookCheck, 
  Library,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type NavTab = 'dashboard' | 'books' | 'members' | 'issue' | 'transactions' | 'reports';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'books', label: 'Books Catalog', icon: BookOpen },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'issue', label: 'Issue Book', icon: BookCheck },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-sm text-slate-100 block">
                Athenaeum
              </span>
              <span className="text-[11px] text-slate-400 font-mono tracking-wider uppercase block">
                Library System
              </span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Staff Profile and Sign Out */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200 truncate capitalize block">
                  {user?.username}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                  user?.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                }`}>
                  {user?.role}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block truncate">
                Single-Branch Staff
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
