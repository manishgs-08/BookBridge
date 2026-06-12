import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart, Trash2, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../api/axios';

interface Book {
  _id: string;
  title: string;
  author: string;
  condition: string;
  price: number;
  type: string;
  image?: string;
  owner: {
    _id: string;
    name: string;
  };
}

interface WishlistItem {
  _id: string;
  book: Book;
  createdAt: string;
}

export const Wishlist: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch wishlisted items
  const { data: wishlistItems, isLoading, isError } = useQuery<WishlistItem[]>({
    queryKey: ['wishlist'],
    queryFn: async () => {
      try {
        const response = await api.get('/wishlist');
        // Handle array responses directly or within an object
        const list = Array.isArray(response.data) ? response.data : (response.data.wishlist || []);
        // Clean out items where the book was deleted (null check)
        return list.filter((item: any) => item.book);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  // Mutation to remove from wishlist
  const removeMutation = useMutation({
    mutationFn: async (bookId: string) => {
      return api.delete(`/wishlist/${bookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to remove book from wishlist.');
    }
  });

  const handleRemove = (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeMutation.mutate(bookId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          My Wishlist
        </h1>
        <p className="text-sm text-slate-500">
          Manage the textbooks you have bookmarked for later
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1].map((i) => (
            <div key={i} className="h-56 bg-slate-200 rounded-2xl border border-slate-100"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-rose-50 border border-rose-100 rounded-2xl">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h3 className="mt-4 font-display font-bold text-slate-900">Failed to load wishlist</h3>
          <p className="mt-2 text-sm text-slate-600">Please try again later.</p>
        </div>
      ) : wishlistItems?.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 font-display font-bold text-slate-900">Your wishlist is empty</h3>
          <p className="mt-2 text-sm text-slate-500">Browse the marketplace and save textbooks you are interested in.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems?.map((item) => (
            <Link 
              key={item._id} 
              to={`/books/${item.book._id}`}
              className="group rounded-2xl border border-slate-250 bg-white p-4 shadow-sm hover:shadow-premium transition flex flex-col justify-between"
            >
              <div className="flex gap-4">
                <div className="h-20 w-15 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center">
                  {item.book.image ? (
                    <img src={item.book.image} alt={item.book.title} className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-bold text-slate-900 leading-snug truncate group-hover:text-indigo-650 transition">
                    {item.book.title}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">by {item.book.author}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      Condition: {item.book.condition}
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                      {item.book.type === 'Sell' ? `$${item.book.price}` : item.book.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Listed by: <strong className="font-semibold text-slate-700">{item.book.owner.name}</strong></span>
                <button
                  onClick={(e) => handleRemove(item.book._id, e)}
                  disabled={removeMutation.isPending}
                  className="inline-flex items-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                  title="Remove Bookmark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
export default Wishlist;
