import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, BookOpen, AlertCircle, X, Check } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

interface Book {
  _id: string;
  title: string;
  author: string;
  isbn?: string;
  category: string;
  condition: 'New' | 'Like New' | 'Very Good' | 'Good' | 'Fair' | 'Poor';
  price: number;
  type: 'Sell' | 'Exchange' | 'Free';
  exchangeFor?: string;
  image?: string;
  status: 'Available' | 'Reserved' | 'Exchanged' | 'Sold';
  description?: string;
}

const CATEGORIES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Engineering',
  'Business & Economics',
  'Literature',
  'Other'
];

const CONDITIONS = [
  'New',
  'Like New',
  'Very Good',
  'Good',
  'Fair',
  'Poor'
];

export const Inventory: React.FC = () => {
  const { isVerifiedSeller, user } = useAuth();
  const queryClient = useQueryClient();

  // Temporary debugging - remove after verification
  console.log('Inventory Auth Check', {
    role: user?.role,
    seller_verified: user?.seller_verified,
    isVerifiedSeller,
    user,
  });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[2]); // Very Good
  const [type, setType] = useState<'Sell' | 'Exchange' | 'Free'>('Sell');
  const [price, setPrice] = useState<number | string>('');
  const [exchangeFor, setExchangeFor] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');

  // Form error states
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch my inventory
  const { data: myBooks, isLoading, isError } = useQuery<Book[]>({
    queryKey: ['my-inventory'],
    queryFn: async () => {
      try {
        const response = await api.get('/books/my-inventory');
        return Array.isArray(response.data) ? response.data : (response.data.books || []);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  const openAddModal = () => {
    setEditingBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setCategory(CATEGORIES[0]);
    setCondition(CONDITIONS[2]);
    setType('Sell');
    setPrice('');
    setExchangeFor('');
    setImage('');
    setDescription('');
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn || '');
    setCategory(book.category);
    setCondition(book.condition);
    setType(book.type);
    setPrice(book.price);
    setExchangeFor(book.exchangeFor || '');
    setImage(book.image || '');
    setDescription(book.description || '');
    setFormError(null);
    setFieldErrors({});
    setModalOpen(true);
  };

  // Mutation to add/edit book
  const submitMutation = useMutation({
    mutationFn: async () => {
      let parsedPrice = 0;
      if (type === 'Sell') {
        const p = parseFloat(String(price));
        parsedPrice = isNaN(p) ? 0 : p;
      }
      
      const payload = {
        title,
        author,
        isbn: isbn || undefined,
        category,
        condition,
        type,
        asking_price: parsedPrice,
        exchangeFor: type === 'Exchange' ? exchangeFor : undefined,
        image: image || undefined,
        description: description || undefined
      };

      console.log("Create Book Payload:", payload);
      console.log("asking_price:", payload.asking_price);
      console.log("Type:", typeof payload.asking_price);

      if (editingBook) {
        return api.put(`/books/${editingBook._id}`, payload);
      } else {
        return api.post('/books', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setModalOpen(false);
      setFormError(null);
      setFieldErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error occurred while saving listing.';
      
      // Inline UX error routing
      if (msg.toLowerCase().includes('asking price')) {
        setFieldErrors({ price: msg });
        setFormError(null);
      } else {
        setFormError(msg);
        setFieldErrors({});
      }
    }
  });

  // Mutation to delete book
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/books/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error occurred while deleting listing.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    submitMutation.mutate();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      deleteMutation.mutate(id);
    }
  };

  if (!isVerifiedSeller) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h2 className="font-display text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500 text-center max-w-md">
          You must be a verified seller to list textbooks in your inventory.
        </p>
        <Link 
          to="/profile" 
          className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
        >
          Verify as Seller
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Inventory
          </h1>
          <p className="text-sm text-slate-500">
            List and manage textbooks you want to sell, exchange, or give away
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-650 bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-750 hover:shadow-premium transition"
        >
          <Plus className="mr-1.5 h-4 w-4 stroke-[2.5]" />
          <span>List a Book</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 bg-slate-200 rounded-2xl border border-slate-100"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-rose-50 border border-rose-100 rounded-2xl">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h3 className="mt-4 font-display font-bold text-slate-900">Failed to load inventory</h3>
          <p className="mt-2 text-sm text-slate-600">Please try again later.</p>
        </div>
      ) : myBooks?.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-slate-350" />
          <h3 className="mt-4 font-display font-bold text-slate-900">No books listed</h3>
          <p className="mt-2 text-sm text-slate-500">You haven't added any books to your exchange inventory yet.</p>
          <button
            onClick={openAddModal}
            className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-550 underline"
          >
            Create your first listing now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myBooks?.map((book) => (
            <div 
              key={book._id} 
              className="rounded-2xl border border-slate-250 bg-white p-5 shadow-sm hover:shadow-premium transition flex flex-col justify-between"
            >
              <div className="flex gap-4">
                <div className="h-24 w-18 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center">
                  {book.image ? (
                    <img src={book.image} alt={book.title} className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-8 w-8 text-slate-350" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                    {book.category}
                  </span>
                  <h4 className="mt-1.5 font-display font-bold text-slate-900 leading-snug truncate">
                    {book.title}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">by {book.author}</p>
                  
                  {/* Status Indicator */}
                  <div className="mt-2 flex items-center space-x-2">
                    <span className={`h-2 w-2 rounded-full ${
                      book.status === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></span>
                    <span className="text-xs text-slate-600">{book.status}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trading Type</span>
                  <p className="text-sm font-bold text-slate-900">
                    {book.type === 'Sell' ? `$${book.price}` : book.type}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(book)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                    title="Edit Listing"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(book._id)}
                    className="p-2 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Delete Listing"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 p-6 max-h-[90vh] overflow-y-auto relative animate-fade-in">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-extrabold text-slate-900">
              {editingBook ? 'Edit Book Listing' : 'List a Textbook'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide textbook parameters so other classmates can find it.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600 border border-rose-100 flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Book Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Book Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                    placeholder="e.g. Introduction to Algorithms"
                    required
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Author(s)
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                    placeholder="e.g. Cormen, Leiserson"
                    required
                  />
                </div>

                {/* ISBN */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    ISBN (optional)
                  </label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                    placeholder="e.g. 9780262033848"
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Image URL (optional)
                  </label>
                  <input
                    type="url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                    placeholder="https://example.com/book.jpg"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                  >
                    {CONDITIONS.map(cond => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>

                {/* Exchange / Sell option */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Offer Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                  >
                    <option value="Sell">Sell (For Cash)</option>
                    <option value="Exchange">Exchange (Swap books)</option>
                    <option value="Free">Free / Donation</option>
                  </select>
                </div>

                {/* Dynamic Price or swap targets */}
                {type === 'Sell' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Price ($)
                    </label>
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={`block w-full rounded-lg border ${fieldErrors.price ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-550'} py-2 px-3 text-sm focus:outline-none shadow-sm`}
                      required
                    />
                    {fieldErrors.price && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center">
                        <X className="h-3 w-3 mr-1" />
                        {fieldErrors.price}
                      </p>
                    )}
                  </div>
                )}

                {type === 'Exchange' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Looking For (book details)
                    </label>
                    <input
                      type="text"
                      value={exchangeFor}
                      onChange={(e) => setExchangeFor(e.target.value)}
                      className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                      placeholder="e.g. Chemistry 101 or Linear Algebra"
                      required
                    />
                  </div>
                )}

              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-550 focus:outline-none shadow-sm"
                  placeholder="Provide any extra details about the book condition, highlight levels, or campus meeting preferences..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="rounded-lg bg-indigo-650 bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-750 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {submitMutation.isPending ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{editingBook ? 'Save Changes' : 'Publish Listing'}</span>
                      <Check className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Inventory;
