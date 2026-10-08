import React, { useState, useEffect, useTransition } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  BookCheck, 
  AlertCircle, 
  X,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Book } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface BooksProps {
  onIssueBook: (book: Book) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const Books: React.FC<BooksProps> = ({ onIssueBook, showToast }) => {
  const { isAdmin } = useAuth();
  const [, startTransition] = useTransition();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [deleteBookTarget, setDeleteBookTarget] = useState<Book | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form states
  const [formData, setFormData] = useState({
    isbn: '',
    title: '',
    author: '',
    category: '',
    total_copies: 1,
  });

  const categoriesList = [
    'Computer Science',
    'Software Engineering',
    'Programming Languages',
    'Databases',
    'Networking',
    'Artificial Intelligence',
    'Data Science',
    'Mathematics',
    'Literature',
    'General Sciences'
  ];

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await api.getBooks({
        search: searchTerm,
        category: selectedCategory,
        availability: selectedAvailability,
      });
      setBooks(res.books);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load books catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [selectedCategory, selectedAvailability]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        loadBooks();
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setFormData({
      isbn: '',
      title: '',
      author: '',
      category: 'Computer Science',
      total_copies: 5,
    });
    setFormErrors({});
    setIsAddOpen(true);
  };

  const handleOpenEdit = (b: Book) => {
    setEditBook(b);
    setFormData({
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      category: b.category,
      total_copies: b.total_copies,
    });
    setFormErrors({});
  };

  const validateForm = (isEdit: boolean) => {
    const errors: Record<string, string> = {};
    const cleanIsbn = formData.isbn.replace(/[-\s]/g, '').toUpperCase();
    if (!cleanIsbn || (cleanIsbn.length !== 10 && cleanIsbn.length !== 13)) {
      errors.isbn = 'ISBN must be 10 or 13 digits.';
    }
    if (!formData.title.trim() || formData.title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters.';
    }
    if (!formData.author.trim() || formData.author.trim().length < 2) {
      errors.author = 'Author must be at least 2 characters.';
    }
    if (!formData.category) {
      errors.category = 'Category is required.';
    }
    const copies = Number(formData.total_copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 500) {
      errors.total_copies = 'Total copies must be between 1 and 500.';
    } else if (isEdit && editBook) {
      const issued = editBook.total_copies - editBook.available_copies;
      if (copies < issued) {
        errors.total_copies = `Cannot reduce below ${issued} copies currently on loan.`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setSubmitting(true);
    try {
      const res = await api.createBook(formData);
      showToast('success', res.message);
      setIsAddOpen(false);
      loadBooks();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create book');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBook || !validateForm(true)) return;

    setSubmitting(true);
    try {
      const res = await api.updateBook(editBook.id, formData);
      showToast('success', res.message);
      setEditBook(null);
      loadBooks();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update book');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteBookTarget) return;
    setSubmitting(true);
    try {
      const res = await api.deleteBook(deleteBookTarget.id);
      showToast('success', res.message);
      setDeleteBookTarget(null);
      loadBooks();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Book Inventory Catalog
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage catalog titles, copy quantities, and circulating volumes
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Add New Book</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Title, Author, or ISBN..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="All">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Availability Filter */}
        <select
          value={selectedAvailability}
          onChange={(e) => setSelectedAvailability(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
        >
          <option value="All">All Availability</option>
          <option value="Available">Available (Full)</option>
          <option value="Partially Available">Partially Available</option>
          <option value="Unavailable">Unavailable (0 left)</option>
        </select>
      </div>

      {/* Books Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Title & Author</th>
                <th className="py-3 px-4">ISBN</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Copies (Avail / Total)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading book catalog...
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">No books found</p>
                    <p className="text-xs text-slate-500 mt-1">Try refining search parameters or add a new title.</p>
                  </td>
                </tr>
              ) : (
                books.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{b.title}</div>
                      <div className="text-slate-500 mt-0.5">{b.author}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {b.isbn}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {b.category}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {b.available_copies}
                      </span>
                      <span className="text-slate-400 font-mono"> / {b.total_copies}</span>
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'Available' && (
                        <span className="text-emerald-700 font-medium">Available</span>
                      )}
                      {b.status === 'Partially Available' && (
                        <span className="text-amber-700 font-medium">Partially Available</span>
                      )}
                      {b.status === 'Unavailable' && (
                        <span className="text-rose-700 font-medium">Unavailable</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {b.available_copies > 0 && (
                          <button
                            onClick={() => onIssueBook(b)}
                            title="Issue this book"
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <BookCheck className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(b)}
                          title="Edit book details"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteBookTarget(b)}
                          title={isAdmin ? "Delete book" : "Only administrators can delete books"}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add / Edit Book Modal */}
      {(isAddOpen || editBook) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editBook ? 'Edit Book Details' : 'Add New Book Title'}
              </h3>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditBook(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editBook ? handleEditSubmit : handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ISBN (10 or 13 digits) *
                </label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  placeholder="e.g. 9780134685991"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {formErrors.isbn && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.isbn}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Book Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Effective Java"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {formErrors.title && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Author *
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="e.g. Joshua Bloch"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {formErrors.author && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.author}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Total Copies (1–500) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={formData.total_copies}
                    onChange={(e) => setFormData({ ...formData, total_copies: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  {formErrors.total_copies && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.total_copies}</p>
                  )}
                </div>
              </div>

              {editBook && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">Current Circulation State:</span> {editBook.total_copies - editBook.available_copies} copies currently on loan. Available copies will automatically adjust.
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditBook(null);
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
                  {submitting ? 'Saving...' : editBook ? 'Update Book' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteBookTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-semibold text-slate-900">Confirm Book Deletion</h3>
            </div>

            {!isAdmin ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Permission Denied: Only staff with <strong>ADMINISTRATOR</strong> role can delete books. As a Librarian, book catalog deletion is restricted.
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteBookTarget(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to delete <strong>"{deleteBookTarget.title}"</strong> (ISBN: {deleteBookTarget.isbn})?
                </p>
                <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                  Rule Enforcement: The system will verify if any past or active circulation history exists. Deletion will be rejected if this book has ever been checked out.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setDeleteBookTarget(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={submitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Verifying & Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
