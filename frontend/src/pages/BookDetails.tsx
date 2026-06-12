import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  BookOpen, 
  MessageSquare, 
  Heart, 
  Info, 
  Star, 
  Calendar,
  Send,
  X,
  Plus
} from 'lucide-react';
import { BackButton } from '../components/BackButton';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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
    email: string;
  };
  status: 'Available' | 'Reserved' | 'Exchanged' | 'Sold';
  description?: string;
  createdAt: string;
}

interface UserInventoryBook {
  _id: string;
  title: string;
  author: string;
}

export const BookDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [proposedPrice, setProposedPrice] = useState<number>(0);
  const [selectedOfferedBookId, setSelectedOfferedBookId] = useState('');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  
  // User's inventory for swaps
  const [userInventory, setUserInventory] = useState<UserInventoryBook[]>([]);

  // Fetch book details
  const { data: book, isLoading, isError } = useQuery<Book>({
    queryKey: ['book', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/books/${id}`);
        return response.data;
      } catch (err) {
        console.error('Failed to fetch book from server:', err);
        throw err;
      }
    }
  });

  // Fetch wishlist state
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const fetchWishlist = async () => {
      try {
        const response = await api.get('/wishlist');
        const list = Array.isArray(response.data) ? response.data : (response.data.wishlist || []);
        setWishlistIds(list.map((item: any) => item.book?._id || item.book || item._id));
      } catch (err) {
        console.warn(err);
      }
    };
    fetchWishlist();
  }, [isAuthenticated]);

  // Fetch user's inventory (to offer as trade swaps)
  React.useEffect(() => {
    if (!isAuthenticated || !requestModalOpen) return;
    const fetchInventory = async () => {
      try {
        const response = await api.get('/books/my-inventory');
        const list = Array.isArray(response.data) ? response.data : (response.data.books || []);
        setUserInventory(list);
      } catch (err) {
        throw err;
      }
    };
    fetchInventory();
  }, [isAuthenticated, requestModalOpen]);

  // Initialize proposed price when book is loaded
  React.useEffect(() => {
    if (book) {
      setProposedPrice(book.price);
    }
  }, [book]);

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const bookId = id!;
    try {
      if (wishlistIds.includes(bookId)) {
        await api.delete(`/wishlist/${bookId}`);
        setWishlistIds(prev => prev.filter(id => id !== bookId));
      } else {
        await api.post('/wishlist', { bookId });
        setWishlistIds(prev => [...prev, bookId]);
      }
    } catch (err) {
      if (wishlistIds.includes(bookId)) {
        setWishlistIds(prev => prev.filter(id => id !== bookId));
      } else {
        setWishlistIds(prev => [...prev, bookId]);
      }
    }
  };

  const handleSendMessage = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (book) {
      // Redirect to messages with query search params
      navigate(`/messages?userId=${book.owner._id}&bookId=${book._id}`);
    }
  };

  const requestMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        bookId: id,
        message: requestMessage,
      };
      if (book?.type === 'Sell') {
        payload.proposedPrice = proposedPrice;
      }
      if (book?.type === 'Exchange' && selectedOfferedBookId) {
        payload.offeredBookId = selectedOfferedBookId;
      }
      return api.post('/requests', payload);
    },
    onSuccess: () => {
      setRequestModalOpen(false);
      setRequestMessage('');
      // Toast notification placeholder
      alert('Your request has been sent successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to submit request. Please try again.');
    }
  });

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    requestMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-12 space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-slate-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-slate-200 rounded"></div>
            <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
            <div className="h-20 bg-slate-200 rounded"></div>
            <div className="h-10 w-full bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="text-center py-16">
        <ArrowLeft className="mx-auto h-12 w-12 text-slate-350" />
        <h3 className="mt-4 font-display font-bold text-slate-900">Book not found</h3>
        <p className="mt-2 text-sm text-slate-500">The book listing you are looking for may have been deleted or sold.</p>
        <Link to="/" className="mt-6 inline-flex items-center text-sm font-semibold text-indigo-650 hover:underline">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Marketplace
        </Link>
      </div>
    );
  }

  const isOwner = user?.user_id != null && String(user.user_id) === String(book.owner._id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button */}
      <BackButton />

      {/* Main Container */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left: Media Column */}
          <div className="md:col-span-5 flex flex-col space-y-4">
            <div className="aspect-[3/4] w-full rounded-2xl bg-slate-100 border border-slate-100 overflow-hidden flex items-center justify-center">
              {book.image ? (
                <img src={book.image} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-24 w-24 text-slate-300" />
              )}
            </div>
          </div>

          {/* Right: Info Column */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Category, Condition tags */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {book.category}
                </span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-750 border border-indigo-100">
                  Condition: {book.condition}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  book.status === 'Available' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {book.status}
                </span>
              </div>

              {/* Title & Author */}
              <div className="space-y-1">
                <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                  {book.title}
                </h1>
                <p className="text-base text-slate-500 font-medium">by {book.author}</p>
              </div>

              {/* Price or Exchange Display */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trading Option</span>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {book.type === 'Sell' ? `$${book.price}` : book.type}
                    </span>
                  </div>
                </div>
                {book.type === 'Exchange' && book.exchangeFor && (
                  <div className="text-right border-l border-slate-200 pl-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Looking for:</span>
                    <p className="mt-0.5 text-sm font-semibold text-indigo-700 max-w-[200px] truncate">{book.exchangeFor}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {book.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center">
                    <Info className="h-4 w-4 mr-1.5 text-slate-400" />
                    About this textbook
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                    {book.description}
                  </p>
                </div>
              )}

              {/* Metadata details */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-4 text-xs text-slate-500">
                {book.isbn && (
                  <div>
                    <span className="font-semibold text-slate-400 uppercase">ISBN</span>
                    <p className="mt-0.5 font-medium text-slate-900">{book.isbn}</p>
                  </div>
                )}
                <div className="flex items-start">
                  <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                  <div>
                    <span className="font-semibold text-slate-400 uppercase">Listed On</span>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {new Date(book.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA action section */}
            <div className="space-y-3">
              {isOwner ? (
                <div className="rounded-xl bg-indigo-50/50 p-4 border border-indigo-100 text-center">
                  <p className="text-sm text-indigo-750 font-medium">
                    This is your listing. You can manage it from your inventory panel.
                  </p>
                  <Link 
                    to="/inventory"
                    className="mt-2.5 inline-flex items-center text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Go to My Inventory &rarr;
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {book.status === 'Reserved' && (
                    <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-center">
                      <p className="text-sm text-amber-800 font-medium">
                        This book is currently under negotiation and cannot receive new offers.
                      </p>
                    </div>
                  )}
                  {book.status === 'Sold' && (
                    <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-center">
                      <p className="text-sm text-red-800 font-medium">
                        This book has already been sold.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    {book.status === 'Available' && (
                      <button
                        onClick={() => setRequestModalOpen(true)}
                        className="flex-1 flex justify-center items-center rounded-xl bg-indigo-650 bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-750 hover:shadow-premium transition"
                      >
                        <span>Request Book</span>
                      </button>
                    )}
                    <button
                      onClick={handleSendMessage}
                      className="flex-1 sm:flex-none flex justify-center items-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-350 transition"
                    >
                      <MessageSquare className="h-4.5 w-4.5 mr-2 text-slate-550" />
                      <span>Message Owner</span>
                    </button>
                    <button
                      onClick={handleToggleWishlist}
                      className={`flex items-center justify-center p-3.5 rounded-xl border transition ${
                        wishlistIds.includes(book._id) 
                          ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-600'
                      }`}
                      title={wishlistIds.includes(book._id) ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart className={`h-5 w-5 ${wishlistIds.includes(book._id) ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Owner details card */}
              <div className="rounded-2xl border border-slate-150 p-4 flex items-center justify-between mt-6 bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-bold font-display text-sm">
                    {book.owner.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Owner</span>
                    <h5 className="font-display font-bold text-slate-900 text-sm">{book.owner.name}</h5>
                  </div>
                </div>
                {book.owner.rating && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rating</span>
                    <div className="flex items-center text-amber-500 text-sm font-bold">
                      <Star className="h-4 w-4 fill-amber-500 mr-1" />
                      {book.owner.rating.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Request Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-6 relative animate-fade-in">
            <button 
              onClick={() => setRequestModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-lg font-bold text-slate-900 pr-8">
              Send Book Request
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide terms and messages to {book.owner.name} to exchange this book
            </p>

            <form onSubmit={handleRequestSubmit} className="mt-6 space-y-4">
              {/* Dynamic counter pricing offer */}
              {book.type === 'Sell' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Proposed Offer ($)
                  </label>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(Math.max(0, Number(e.target.value)))}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-550 shadow-sm"
                    required
                  />
                </div>
              )}

              {/* Dynamic swap option selection */}
              {book.type === 'Exchange' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Offer one of your textbooks:
                  </label>
                  {userInventory.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
                      <p className="text-xs text-slate-500">You don't have any books in your inventory to trade.</p>
                      <Link to="/inventory" className="text-xs font-bold text-indigo-650 hover:underline mt-1.5 inline-flex items-center">
                        <Plus className="h-3 w-3 mr-1" /> List a book first
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={selectedOfferedBookId}
                      onChange={(e) => setSelectedOfferedBookId(e.target.value)}
                      className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-550 shadow-sm"
                      required
                    >
                      <option value="">-- Select a textbook to swap --</option>
                      {userInventory.map(item => (
                        <option key={item._id} value={item._id}>{item.title} (by {item.author})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Message to Owner
                </label>
                <textarea
                  rows={4}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Hey, I'd love to trade or purchase this book for class. Let's arrange a meetup at the campus library!"
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-550 shadow-sm"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestMutation.isPending || (book.type === 'Exchange' && !selectedOfferedBookId)}
                  className="flex-1 rounded-lg bg-indigo-650 bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-750 transition disabled:opacity-50 flex justify-center items-center"
                >
                  {requestMutation.isPending ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Send Request</span>
                      <Send className="h-4 w-4 ml-1.5" />
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
export default BookDetails;
