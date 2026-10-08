import React, { useState, useEffect, useTransition } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Edit3, 
  BookCheck, 
  Clock, 
  X, 
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Member, IssueTransaction } from '../types.ts';

interface MembersProps {
  onIssueToMember: (member: Member) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const Members: React.FC<MembersProps> = ({ onIssueToMember, showToast }) => {
  const [, startTransition] = useTransition();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [detailsMember, setDetailsMember] = useState<{
    member: Member;
    activeLoans: IssueTransaction[];
    history: IssueTransaction[];
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    member_type: 'Student' | 'Faculty' | 'Staff';
  }>({
    name: '',
    email: '',
    phone: '',
    member_type: 'Student',
  });

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api.getMembers({
        search: searchTerm,
        type: selectedType,
        status: selectedStatus,
      });
      setMembers(res.members);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [selectedType, selectedStatus]);

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        loadMembers();
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      member_type: 'Student',
    });
    setFormErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditMember(m);
    setFormData({
      name: m.name,
      email: m.email,
      phone: m.phone,
      member_type: m.member_type,
    });
    setFormErrors({});
  };

  const handleOpenDetails = async (m: Member) => {
    try {
      const res = await api.getMember(m.id);
      setDetailsMember(res);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load member profile');
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2 || formData.name.trim().length > 60) {
      errors.name = 'Name must be between 2 and 60 characters.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = 'Valid email address is required.';
    }
    const cleanPhone = formData.phone.replace(/[-\s+]/g, '');
    const phoneValid = /^[6-9][0-9]{9}$/.test(cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone);
    if (!phoneValid) {
      errors.phone = 'Must be a 10-digit Indian mobile number beginning with 6, 7, 8, or 9.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await api.createMember(formData);
      showToast('success', res.message);
      setIsAddOpen(false);
      loadMembers();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember || !validateForm()) return;

    setSubmitting(true);
    try {
      const res = await api.updateMember(editMember.id, formData);
      showToast('success', res.message);
      setEditMember(null);
      loadMembers();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (m: Member) => {
    try {
      const res = await api.toggleMemberStatus(m.id);
      showToast('info', res.message);
      loadMembers();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to change status');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Library Member Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registered students, faculty, and administrative staff cardholders
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Register New Member</span>
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
            placeholder="Search by Name, Code (e.g. M001), Email, Phone..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="All">All Member Types</option>
            <option value="Student">Student</option>
            <option value="Faculty">Faculty</option>
            <option value="Staff">Staff</option>
          </select>
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active Only</option>
          <option value="Inactive">Inactive Only</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Member ID</th>
                <th className="py-3 px-4">Name & Contact</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-center">Active Loans</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading members directory...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">No members found</p>
                    <p className="text-xs text-slate-500 mt-1">Try modifying search or add a new cardholder.</p>
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {m.member_code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{m.name}</div>
                      <div className="text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{m.email}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{m.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {m.member_type}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenDetails(m)}
                        className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-slate-900 hover:text-emerald-700"
                        title="Click to view borrowed books"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{m.active_loans_count || 0} / 3</span>
                        {m.has_overdue && (
                          <span className="text-[10px] text-rose-600 font-bold ml-1">
                            (OVERDUE)
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {m.active ? (
                        <span className="text-emerald-700 font-medium">Active</span>
                      ) : (
                        <span className="text-slate-500 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {m.active && (m.active_loans_count || 0) < 3 && !m.has_overdue && (
                          <button
                            onClick={() => onIssueToMember(m)}
                            title="Issue book to this member"
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <BookCheck className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenDetails(m)}
                          title="Borrowing history"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(m)}
                          title="Edit member details"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(m)}
                          title={m.active ? "Deactivate account" : "Activate account"}
                          className={`p-1.5 rounded transition-colors ${
                            m.active 
                              ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' 
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {m.active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {(isAddOpen || editMember) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editMember ? `Edit Cardholder (${editMember.member_code})` : 'Register New Cardholder'}
              </h3>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditMember(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editMember ? handleEditSubmit : handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name (2–60 characters) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Aarav Sharma"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {formErrors.name && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. aarav.sharma@campus.edu"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {formErrors.email && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone (10-digit Indian Mobile) *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Member Type *
                  </label>
                  <select
                    value={formData.member_type}
                    onChange={(e) => setFormData({ ...formData, member_type: e.target.value as 'Student' | 'Faculty' | 'Staff' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>

              {!editMember && (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Sequential Identifier: A permanent member code (e.g. M008) will be assigned automatically upon registration.
                </p>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditMember(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editMember ? 'Update Cardholder' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details Drawer (Active Loans + History) */}
      {detailsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    {detailsMember.member.name}
                  </h3>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    ({detailsMember.member.member_code})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{detailsMember.member.member_type}</span>
                  <span aria-hidden="true">·</span>
                  <span>{detailsMember.member.email}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{detailsMember.member.phone}</span>
                </div>
              </div>

              <button
                onClick={() => setDetailsMember(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Member Eligibility Summary */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs">
                <div>
                  <span className="text-slate-500 block">Current Loans</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {detailsMember.activeLoans.length} / 3
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Capacity Left</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    {detailsMember.member.remaining_capacity} books
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className={`font-semibold ${detailsMember.member.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {detailsMember.member.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Active Loans List */}
              <div>
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                  Currently Borrowed Books ({detailsMember.activeLoans.length})
                </h4>
                {detailsMember.activeLoans.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                    No books currently issued to this member.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {detailsMember.activeLoans.map((loan) => (
                      <div key={loan.id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{loan.book_title}</p>
                          <p className="text-slate-500 text-[11px]">
                            Issued: {loan.issue_date} · Due: {loan.due_date}
                          </p>
                        </div>
                        <div className="text-right">
                          {loan.is_overdue ? (
                            <span className="text-rose-600 font-semibold block">
                              OVERDUE ({loan.days_late}d late · ₹{loan.fine_so_far} fine)
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium block">
                              Active Loan
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past Borrowing History */}
              <div>
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
                  Past Borrowing History ({detailsMember.history.length})
                </h4>
                {detailsMember.history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                    No returned loan history recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {detailsMember.history.map((hist) => (
                      <div key={hist.id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-medium text-slate-900">{hist.book_title}</p>
                          <p className="text-slate-500 text-[11px]">
                            {hist.issue_date} to {hist.return_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-700 font-medium">Returned</span>
                          {hist.fine > 0 && (
                            <span className="text-rose-600 text-[11px] block font-mono">
                              Fine Paid: ₹{hist.fine.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {detailsMember.member.active && detailsMember.activeLoans.length < 3 && !detailsMember.member.has_overdue ? (
                <button
                  onClick={() => {
                    onIssueToMember(detailsMember.member);
                    setDetailsMember(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                >
                  Issue New Book to Member
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  {detailsMember.member.has_overdue ? 'Borrowing blocked due to overdue loans' : !detailsMember.member.active ? 'Account inactive' : 'Max 3 books limit reached'}
                </span>
              )}

              <button
                onClick={() => setDetailsMember(null)}
                className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
