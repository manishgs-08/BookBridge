import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, 
  X, 
  RefreshCw, 
  MessageSquare, 
  DollarSign, 
  Clock,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import api from '../api/axios';

interface Book {
  _id: string;
  title: string;
  author: string;
  price: number;
  type: 'Sell' | 'Exchange' | 'Free';
  image?: string;
}

interface UserSummary {
  _id: string;
  name: string;
  rating?: number;
}

interface Request {
  _id: string;
  book: Book;
  buyer: UserSummary;
  seller: UserSummary;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Negotiating';
  proposedPrice?: number;
  offeredBook?: Book;
  message?: string;
  createdAt: string;
}

interface NegotiationRound {
  _id: string;
  sender: UserSummary;
  message: string;
  proposedPrice?: number;
  offeredBook?: Book;
  createdAt: string;
}

export const Requests: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [negotiationRequest, setNegotiationRequest] = useState<Request | null>(null);
  
  // Negotiation form state
  const [negMessage, setNegMessage] = useState('');
  const [negPrice, setNegPrice] = useState<number>(0);

  // Fetch Requests
  const { data: requests, isLoading, isError } = useQuery<Request[]>({
    queryKey: ['requests'],
    queryFn: async () => {
      try {
        const response = await api.get('/requests');
        return Array.isArray(response.data) ? response.data : (response.data.requests || []);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  // Fetch negotiation history for selected request
  const { data: negotiationHistory, refetch: refetchHistory } = useQuery<NegotiationRound[]>({
    queryKey: ['negotiations', negotiationRequest?._id],
    enabled: !!negotiationRequest,
    queryFn: async () => {
      try {
        const response = await api.get(`/negotiations/${negotiationRequest?._id}`);
        return Array.isArray(response.data) ? response.data : (response.data.negotiations || []);
      } catch (err) {
        throw err;
      }
    }
  });

  // Update request status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'Accepted' | 'Declined' }) => {
      return api.patch(`/requests/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setNegotiationRequest(null);
      alert('Request status updated successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update request.');
    }
  });

  // Submit counter offer mutation
  const counterMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        requestId: negotiationRequest?._id,
        message: negMessage
      };
      if (negotiationRequest?.book.type === 'Sell') {
        payload.proposedPrice = negPrice;
      }
      return api.post('/negotiations', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      refetchHistory();
      setNegMessage('');
      alert('Counter offer sent successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to send counter offer.');
    }
  });

  // Separate incoming and outgoing (we check if seller._id is user.user_id, but since we might not have user object loaded in some mock setups, let's look at buyer/seller name)
  const incoming = requests?.filter(r => r.seller._id !== 'myuser' && r.seller.name !== 'Me') || [];
  const outgoing = requests?.filter(r => r.buyer._id === 'myuser' || r.buyer.name === 'Me') || [];

  const handleUpdateStatus = (id: string, status: 'Accepted' | 'Declined') => {
    if (window.confirm(`Are you sure you want to mark this request as ${status}?`)) {
      updateStatusMutation.mutate({ id, status });
    }
  };

  const openNegotiate = (req: Request) => {
    setNegotiationRequest(req);
    setNegPrice(req.proposedPrice || req.book.price);
    setNegMessage('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Requests & Trade Negotiations
          </h1>
          <p className="text-sm text-slate-500">
            Manage incoming bids for your textbooks and outgoing trades you initiated
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center space-x-2 border-b-2 py-4 px-6 text-sm font-semibold transition ${
            activeTab === 'incoming'
              ? 'border-indigo-600 text-indigo-650'
              : 'border-transparent text-slate-550 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft className="h-4.5 w-4.5 text-emerald-500" />
          <span>Incoming Requests ({incoming.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center space-x-2 border-b-2 py-4 px-6 text-sm font-semibold transition ${
            activeTab === 'outgoing'
              ? 'border-indigo-600 text-indigo-650'
              : 'border-transparent text-slate-550 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="h-4.5 w-4.5 text-indigo-500" />
          <span>Outgoing Requests ({outgoing.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl border"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-rose-50 border border-rose-100 rounded-2xl">
          <RefreshCw className="mx-auto h-12 w-12 text-rose-500" />
          <h3 className="mt-4 font-display font-bold text-slate-900">Failed to retrieve requests</h3>
          <p className="mt-2 text-sm text-slate-600">Please try again later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className={`space-y-4 ${negotiationRequest ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {((activeTab === 'incoming' ? incoming : outgoing).length === 0) ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Clock className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 font-display font-bold text-slate-900">No requests here</h3>
              <p className="mt-2 text-sm text-slate-500">
                {activeTab === 'incoming' 
                  ? "You haven't received any requests for your listed textbooks yet." 
                  : "You haven't sent any swap or purchase requests yet."}
              </p>
            </div>
          ) : (
            (activeTab === 'incoming' ? incoming : outgoing).map((req) => (
              <div 
                key={req._id}
                className="rounded-2xl border border-slate-250 bg-white p-5 shadow-sm flex flex-col md:flex-row justify-between gap-4 md:items-center"
              >
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold">
                    <span className={`px-2 py-0.5 rounded ${
                      req.status === 'Pending' 
                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                        : req.status === 'Negotiating'
                          ? 'bg-indigo-50 text-indigo-750 border border-indigo-100'
                          : req.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {req.status}
                    </span>
                    <span className="text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display font-bold text-slate-900 text-base">
                    {req.book.title}
                  </h3>
                  <p className="text-xs text-slate-500">by {req.book.author}</p>
                  
                  {/* Proposal details */}
                  <div className="mt-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100/80 space-y-1.5 max-w-xl">
                    <p className="text-slate-600">
                      <strong className="font-semibold text-slate-900">
                        {activeTab === 'incoming' ? req.buyer.name : `Sent to: ${req.seller.name}`}
                      </strong>: "{req.message}"
                    </p>
                    {req.proposedPrice !== undefined && (
                      <div className="flex items-center space-x-1 text-slate-700 font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Proposed Price: <strong>${req.proposedPrice}</strong></span>
                      </div>
                    )}
                    {req.offeredBook && (
                      <p className="text-slate-700 font-medium">
                        Swap offer: <strong className="text-indigo-700">"{req.offeredBook.title}"</strong> by {req.offeredBook.author}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
                  {req.status === 'Pending' || req.status === 'Negotiating' ? (
                    <>
                      {activeTab === 'incoming' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(req._id, 'Accepted')}
                            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Accept
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req._id, 'Declined')}
                            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 border border-rose-100 transition"
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Decline
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openNegotiate(req)}
                        className="inline-flex items-center px-3.5 py-2 rounded-lg border border-slate-200 hover:border-slate-350 text-slate-750 bg-white text-xs font-bold transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-indigo-500" /> 
                        {activeTab === 'incoming' ? 'Negotiate / Review' : 'View Negotiation'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic font-medium">No actions available</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      {/* Negotiation Slide-out/Modal */}
      {negotiationRequest && (
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[70vh] sticky top-6 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-150 flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Negotiation Chat
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Book: {negotiationRequest.book.title}
                </p>
              </div>
              <button
                onClick={() => setNegotiationRequest(null)}
                className="p-1.5 rounded-full hover:bg-slate-150 text-slate-450 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat/History List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {negotiationHistory?.map((round) => {
                const isMe = round.sender._id === 'myuser' || round.sender.name === 'Me';
                return (
                  <div key={round._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 font-bold mb-1 px-1">{round.sender.name}</span>
                    <div className={`rounded-2xl p-4 max-w-sm text-xs shadow-sm border ${
                      isMe 
                        ? 'bg-indigo-600 border-indigo-650 text-white' 
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                      <p className="leading-relaxed">{round.message}</p>
                      
                      {round.proposedPrice !== undefined && (
                        <div className="mt-2 pt-2 border-t border-white/20 flex items-center font-bold">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>Offered: ${round.proposedPrice}</span>
                        </div>
                      )}
                      
                      {round.offeredBook && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <p className="font-semibold">Swap offer:</p>
                          <p className="italic">"{round.offeredBook.title}"</p>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-450 mt-1 px-1">
                      {new Date(round.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Form Actions */}
            {negotiationRequest.status === 'Pending' || negotiationRequest.status === 'Negotiating' ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  counterMutation.mutate();
                }}
                className="p-6 border-t border-slate-150 bg-white space-y-4"
              >
                {/* Proposed Counter Price */}
                {negotiationRequest.book.type === 'Sell' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Your Counter Price ($)
                    </label>
                    <input
                      type="number"
                      value={negPrice}
                      onChange={(e) => setNegPrice(Math.max(0, Number(e.target.value)))}
                      className="block w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-550 shadow-sm"
                      required
                    />
                  </div>
                )}

                {/* Proposed message */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Counter Message
                  </label>
                  <textarea
                    rows={3}
                    value={negMessage}
                    onChange={(e) => setNegMessage(e.target.value)}
                    placeholder="Provide your counter terms..."
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-550 focus:outline-none shadow-sm"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={counterMutation.isPending}
                    className="flex-1 rounded-lg bg-indigo-650 bg-gradient-to-r from-indigo-600 to-indigo-500 py-2 text-xs font-semibold text-white hover:bg-indigo-750 transition flex justify-center items-center"
                  >
                    <span>Send Counter Offer</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 border-t border-slate-150 bg-slate-50 text-center text-xs text-slate-400 italic">
                This transaction has been closed and cannot be negotiated further.
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  );
};
export default Requests;
