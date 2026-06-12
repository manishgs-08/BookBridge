import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  BookOpen, 
  ShieldAlert, 
  Check, 
  X, 
  Trash2, 
  Lock, 
  Unlock
} from 'lucide-react';
import api from '../api/axios';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

interface BookItem {
  _id: string;
  title: string;
  author: string;
  category: string;
  price: number;
  type: string;
  owner: { name: string };
}

interface DisputeItem {
  _id: string;
  title: string;
  description: string;
  reportedUser: string;
  reporter: { name: string };
  status: 'Pending' | 'Resolved' | 'Dismissed';
  createdAt: string;
}

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'disputes' | 'users' | 'books'>('disputes');

  // Check admin authorization
  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-16 bg-rose-50 border border-rose-100 rounded-2xl">
        <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
        <h3 className="mt-4 font-display font-bold text-slate-900">Access Denied</h3>
        <p className="mt-2 text-sm text-slate-600">You must be logged in as an administrator to access this dashboard.</p>
      </div>
    );
  }

  // Fetch admin disputes
  const { data: disputes, isLoading: isDisputesLoading } = useQuery<DisputeItem[]>({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/disputes');
        return Array.isArray(response.data) ? response.data : (response.data.disputes || []);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  // Fetch admin users
  const { data: users, isLoading: isUsersLoading } = useQuery<UserItem[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/users');
        return Array.isArray(response.data) ? response.data : (response.data.users || []);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  // Fetch admin books
  const { data: books, isLoading: isBooksLoading } = useQuery<BookItem[]>({
    queryKey: ['admin-books'],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/books');
        return Array.isArray(response.data) ? response.data : (response.data.books || []);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  });

  // Resolve/Dismiss dispute mutation
  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'Resolved' | 'Dismissed' }) => {
      return api.patch(`/admin/disputes/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      alert('Dispute status updated successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update dispute status.');
    }
  });

  // Toggle user block status mutation
  const blockUserMutation = useMutation({
    mutationFn: async ({ id, isBlocked }: { id: string; isBlocked: boolean }) => {
      return api.patch(`/admin/users/${id}/block`, { isBlocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      alert('User access status updated successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update user block status.');
    }
  });

  // Remove listed book mutation
  const removeBookMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/books/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      alert('Listing removed successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to remove listing.');
    }
  });

  return (
    <div className="space-y-8">
      {/* Top dashboard header with metrics */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Admin Control Center
        </h1>
        <p className="text-sm text-slate-500">
          Moderate users, resolve filed disputes, and inspect textbook active inventories
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Total Members</span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{users?.length || 0}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Books Listed</span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{books?.length || 0}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Open Disputes</span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              {disputes?.filter(d => d.status === 'Pending').length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs control */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('disputes')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'disputes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Disputes ({disputes?.filter(d => d.status === 'Pending').length || 0})
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'users' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Manage Users ({users?.length || 0})
        </button>
        <button
          onClick={() => setActiveSubTab('books')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'books' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Inspect Books ({books?.length || 0})
        </button>
      </div>

      {/* Core Panels */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-h-[40vh]">
        {/* Disputes Dashboard */}
        {activeSubTab === 'disputes' && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 border-b pb-3 mb-4">Pending Dispute Reports</h3>
            {isDisputesLoading ? (
              <div className="text-center text-xs text-slate-400 py-6">Loading disputes...</div>
            ) : disputes?.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No disputes reported. Workspace is clean!</div>
            ) : (
              disputes?.map((disp) => (
                <div key={disp._id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center space-x-2 text-xs font-semibold">
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px]">
                        {disp.status}
                      </span>
                      <span className="text-slate-400">Reported: {new Date(disp.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-display font-bold text-slate-900 text-sm">{disp.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">"{disp.description}"</p>
                    <div className="text-[10px] text-slate-400 pt-1 font-semibold space-x-3">
                      <span>Reporter: <strong className="text-slate-600">{disp.reporter.name}</strong></span>
                      <span>&bull;</span>
                      <span>Accused: <strong className="text-slate-600">{disp.reportedUser}</strong></span>
                    </div>
                  </div>

                  {disp.status === 'Pending' && (
                    <div className="flex md:flex-col gap-2 items-center self-center justify-end">
                      <button
                        onClick={() => resolveDisputeMutation.mutate({ id: disp._id, status: 'Resolved' })}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 transition"
                      >
                        <Check className="h-3 w-3 mr-1" /> Mark Resolved
                      </button>
                      <button
                        onClick={() => resolveDisputeMutation.mutate({ id: disp._id, status: 'Dismissed' })}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-250 transition"
                      >
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Moderator Board */}
        {activeSubTab === 'users' && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 border-b pb-3 mb-4">Registered Members</h3>
            {isUsersLoading ? (
              <div className="text-center text-xs text-slate-400 py-6">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Email</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {users?.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-semibold text-slate-900">{u.name}</td>
                        <td className="py-3 pr-4">{u.email}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.role === 'admin' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-655'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => blockUserMutation.mutate({ id: u._id, isBlocked: !u.isBlocked })}
                              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                                u.isBlocked 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                              }`}
                            >
                              {u.isBlocked ? (
                                <>
                                  <Unlock className="h-3 w-3 mr-1" /> Unblock
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3 mr-1" /> Suspend
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Textbook Inventory Moderator Board */}
        {activeSubTab === 'books' && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 border-b pb-3 mb-4">Textbooks List</h3>
            {isBooksLoading ? (
              <div className="text-center text-xs text-slate-400 py-6">Loading listings...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">Title</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4">Owner</th>
                      <th className="pb-3 pr-4">Price/Type</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {books?.map((b) => (
                      <tr key={b._id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-semibold text-slate-900 truncate max-w-[200px]">{b.title}</td>
                        <td className="py-3 pr-4">{b.category}</td>
                        <td className="py-3 pr-4">{b.owner.name}</td>
                        <td className="py-3 pr-4 font-semibold">
                          {b.type === 'Sell' ? `$${b.price}` : b.type}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove listing "${b.title}"?`)) {
                                removeBookMutation.mutate(b._id);
                              }
                            }}
                            className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                            title="Remove Textbook Listing"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default Admin;
