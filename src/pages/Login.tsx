import React, { useState } from 'react';
import { Library, Eye, EyeOff, Lock, User as UserIcon, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your login details.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle geometric background backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))]" />

      <div className="relative w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-sm">
            <Library className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Library Management System
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Single-Branch Administration & Circulation Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Staff Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or librarian"
                  required
                  autoFocus
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Accounts Panel */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Demo Staff Credentials (Click to prefill):</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="p-2.5 text-left bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 rounded-lg transition-all text-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">
                    Administrator
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">Full</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  admin / admin123
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('librarian', 'lib12345')}
                className="p-2.5 text-left bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 rounded-lg transition-all text-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 group-hover:text-emerald-400">
                    Librarian
                  </span>
                  <span className="text-[10px] text-sky-400 font-mono">Staff</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  librarian / lib12345
                </div>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-3 leading-normal">
              Notice: These demo accounts are pre-configured. Passwords must be updated via database in production environments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
