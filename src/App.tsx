/**
 * Main Application Orchestrator for Library Management System
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { ToastContainer, ToastMessage } from './components/Toast.tsx';
import { Login } from './pages/Login.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Books } from './pages/Books.tsx';
import { Members } from './pages/Members.tsx';
import { IssueBook } from './pages/IssueBook.tsx';
import { Transactions } from './pages/Transactions.tsx';
import { Reports } from './pages/Reports.tsx';
import { Book, Member, IssueTransaction } from './types.ts';
import { api } from './services/api.ts';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Cross-page navigation state
  const [preselectedBook, setPreselectedBook] = useState<Book | null>(null);
  const [preselectedMember, setPreselectedMember] = useState<Member | null>(null);
  const [initialReturnIssue, setInitialReturnIssue] = useState<IssueTransaction | null>(null);

  // Overdue count for header badge
  const [overdueCount, setOverdueCount] = useState<number>(0);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Poll overdue count for notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchOverdue = async () => {
      try {
        const res = await api.getOverdueReport();
        setOverdueCount(res.overdue.length);
      } catch {
        // quiet error
      }
    };
    fetchOverdue();
  }, [isAuthenticated, currentTab]);

  // Handle direct "Issue this book" action
  const handleIssueBook = (book: Book) => {
    setPreselectedBook(book);
    setCurrentTab('issue');
  };

  // Handle direct "Issue to member" action
  const handleIssueToMember = (member: Member) => {
    setPreselectedMember(member);
    setCurrentTab('issue');
  };

  // Handle direct "Return this book" trigger from Dashboard or Overdue list
  const handleInitiateReturn = (issue: IssueTransaction) => {
    setInitialReturnIssue(issue);
    setCurrentTab('transactions');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider uppercase">Loading Library Terminal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onQuickIssue={() => {
            setPreselectedBook(null);
            setPreselectedMember(null);
            setCurrentTab('issue');
          }}
          overdueCount={overdueCount}
          onViewOverdue={() => {
            setCurrentTab('reports');
          }}
        />

        {/* Dynamic Route View */}
        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigate={setCurrentTab}
              onInitiateReturn={handleInitiateReturn}
            />
          )}

          {currentTab === 'books' && (
            <Books
              onIssueBook={handleIssueBook}
              showToast={showToast}
            />
          )}

          {currentTab === 'members' && (
            <Members
              onIssueToMember={handleIssueToMember}
              showToast={showToast}
            />
          )}

          {currentTab === 'issue' && (
            <IssueBook
              preselectedBook={preselectedBook}
              preselectedMember={preselectedMember}
              onClearPreselections={() => {
                setPreselectedBook(null);
                setPreselectedMember(null);
              }}
              onNavigate={setCurrentTab}
              showToast={showToast}
            />
          )}

          {currentTab === 'transactions' && (
            <Transactions
              initialReturnIssue={initialReturnIssue}
              onClearInitialReturn={() => setInitialReturnIssue(null)}
              showToast={showToast}
            />
          )}

          {currentTab === 'reports' && (
            <Reports
              onInitiateReturn={handleInitiateReturn}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
