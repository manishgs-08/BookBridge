import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter, BookOpen, Star, RefreshCw, PlusCircle, Bookmark } from 'lucide-react';
import api from '../api/axios';

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
  owner: {
    _id: string;
    name: string;
    rating?: number;
  };
  status: 'Available' | 'Reserved' | 'Exchanged' | 'Sold';
  createdAt: string;
}

const CATEGORIES = [
  'All Categories',
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
  'All Conditions',
  'New',
  'Like New',
  'Very Good',
  'Good',
  'Fair',
  'Poor'
];

const TYPES = [
  { label: 'All Listings', value: '' },
  { label: 'For Sale', value: 'Sell' },
  { label: 'For Exchange', value: 'Exchange' },
  { label: 'Free', value: 'Free' }
];

const STATUSES = ['All Books', 'Available', 'Reserved', 'Sold'];

export const Home: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [condition, setCondition] = useState('All Conditions');
  const [status, setStatus] = useState('All Books');
  const [type, setType] = useState('');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Fetch wishlist ids to show bookmark status
  React.useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const response = await api.get('/wishlist');
        const list = Array.isArray(response.data) ? response.data : (response.data.wishlist || []);
        setWishlistIds(list.map((item: any) => item.book?._id || item.book || item._id));
      } catch (err) {
        console.warn('Wishlist retrieval warning, using cached local states', err);
      }
    };
    fetchWishlist();
  }, []);

  const handleToggleWishlist = async (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (wishlistIds.includes(bookId)) {
        await api.delete(`/wishlist/${bookId}`);
        setWishlistIds(prev => prev.filter(id => id !== bookId));
      } else {
        await api.post('/wishlist', { bookId });
        setWishlistIds(prev => [...prev, bookId]);
      }
    } catch (err) {
      console.error('Failed to update wishlist:', err);
      // Optional: show a toast or alert to the user here
    }
  };

  // Fetch books matching criteria
  const { data: books, isLoading, isError, refetch } = useQuery<Book[]>({
    queryKey: ['books', search, category, condition, type, status],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (category !== 'All Categories') params.category = category;
      if (condition !== 'All Conditions') params.condition = condition;
      if (type) params.type = type;
      if (status !== 'All Books') params.status = status;

      try {
        const response = await api.get('/books', { params });
        // Make sure it returns an array
        return Array.isArray(response.data) ? response.data : (response.data.books || []);
      } catch (err) {
        console.error('Failed to fetch books from backend:', err);
        throw err;
      }
    }
  });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-indigo-950 text-white p-8 md:p-12 shadow-premium">
        {/* Background Gradients */}
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"></div>
        <div className="absolute left-1/4 bottom-0 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl"></div>

        <div className="relative max-w-2xl space-y-4">
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
            <span>🎉 Exclusively for Students</span>
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Exchange Textbooks <br />
            With Your Campus Peers
          </h1>
          <p className="text-sm md:text-base text-indigo-200">
            Find required course books at half the cost, or trade your old books for next semester's essentials. Simple, direct, and zero commissions.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link 
              to="/inventory"
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-950 hover:bg-slate-50 hover:shadow-lg transition"
            >
              <PlusCircle className="mr-2 h-4 w-4 text-indigo-600 stroke-[2.5]" />
              <span>List a Textbook</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Discover Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Panel - Desktop */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100">
              <Filter className="h-5 w-5 text-indigo-600" />
              <h3 className="font-display font-bold text-slate-900">Filters</h3>
            </div>

            {/* Category Filter */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</label>
              <div className="grid grid-cols-1 gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition ${
                      category === cat 
                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition Filter */}
            <div className="mt-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Condition</label>
              <div className="grid grid-cols-1 gap-1">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setCondition(cond)}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition ${
                      condition === cond 
                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="mt-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
              <div className="grid grid-cols-1 gap-1">
                {STATUSES.map((stat) => (
                  <button
                    key={stat}
                    onClick={() => setStatus(stat)}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition ${
                      status === stat 
                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {stat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Listings Display Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Search & Layout controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Title, Author, or ISBN..."
                className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-550 focus:outline-none focus:ring-1 focus:ring-indigo-550 transition shadow-sm"
              />
            </div>

            {/* Listing Types tabbed */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl self-stretch sm:self-auto">
              {TYPES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setType(t.value)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    type === t.value 
                      ? 'bg-white text-indigo-700 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Book Cards Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-96 rounded-2xl bg-white border border-slate-100 p-4 space-y-4 animate-pulse">
                  <div className="h-44 w-full bg-slate-200 rounded-xl"></div>
                  <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                  <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
                  <div className="h-6 w-1/3 bg-slate-200 rounded-full"></div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                    <div className="h-8 w-8 rounded-full bg-slate-200"></div>
                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-16 bg-rose-50 border border-rose-100 rounded-2xl">
              <Star className="mx-auto h-12 w-12 text-rose-500" />
              <h3 className="mt-4 font-display font-bold text-slate-900">Failed to load listings</h3>
              <p className="mt-2 text-sm text-slate-600">Something went wrong while communicating with the platform backend.</p>
              <button 
                onClick={() => refetch()}
                className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </button>
            </div>
          ) : books?.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <BookOpen className="mx-auto h-12 w-12 text-slate-350" />
              <h3 className="mt-4 font-display font-bold text-slate-900">No books found</h3>
              <p className="mt-2 text-sm text-slate-500">We couldn't find any textbooks matching your search parameters.</p>
              <button 
                onClick={() => {
                  setSearch('');
                  setCategory('All Categories');
                  setCondition('All Conditions');
                  setType('');
                }}
                className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-550 underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {books?.map((book) => (
                <Link 
                  key={book._id} 
                  to={`/books/${book._id}`}
                  className="group relative flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-premium hover:-translate-y-1 transition duration-300"
                >
                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => handleToggleWishlist(book._id, e)}
                    className="absolute right-3 top-3 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow hover:bg-white text-slate-500 hover:text-rose-500 transition"
                  >
                    <Bookmark 
                      className={`h-4.5 w-4.5 ${
                        wishlistIds.includes(book._id) ? 'fill-rose-500 text-rose-500' : ''
                      }`} 
                    />
                  </button>

                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    {book.image ? (
                      <img 
                        src={book.image} 
                        alt={book.title} 
                        className={`h-full w-full object-cover group-hover:scale-105 transition duration-500 ${
                          book.status !== 'Available' ? 'opacity-80 grayscale-[20%]' : ''
                        }`}
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center text-slate-350 ${
                        book.status !== 'Available' ? 'opacity-80 grayscale-[20%]' : ''
                      }`}>
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                    
                    {/* Status Badges */}
                    {book.status === 'Sold' && (
                      <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-md shadow z-10">
                        Sold
                      </span>
                    )}
                    {book.status === 'Reserved' && (
                      <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-md shadow z-10">
                        Reserved
                      </span>
                    )}

                    {/* Floating badge for trade type */}
                    <span className={`absolute left-3 bottom-3 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md shadow z-10 ${
                      book.type === 'Sell' 
                        ? 'bg-emerald-500 text-white' 
                        : book.type === 'Exchange' 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-indigo-600 text-white'
                    }`}>
                      {book.type === 'Sell' ? `$${book.price}` : book.type}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>{book.category}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {book.condition}
                        </span>
                      </div>
                      <h4 className="mt-2 font-display font-bold text-slate-900 leading-snug group-hover:text-indigo-650 transition truncate">
                        {book.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">by {book.author}</p>
                    </div>

                    {/* Owner detail footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold font-display text-[10px]">
                          {book.owner.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-700 max-w-[90px] truncate">{book.owner.name}</span>
                      </div>
                      {book.owner.rating && (
                        <div className="flex items-center text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-amber-500" />
                          <span className="ml-1 font-bold">{book.owner.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Home;
