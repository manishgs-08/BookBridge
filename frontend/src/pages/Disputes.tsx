import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Send, AlertCircle } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import api from '../api/axios';

export const Disputes: React.FC = () => {
  const navigate = useNavigate();

  // Form states
  const [title, setTitle] = useState('');
  const [reportedUserId, setReportedUserId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [description, setDescription] = useState('');

  // Submit dispute mutation
  const disputeMutation = useMutation({
    mutationFn: async () => {
      return api.post('/disputes', {
        title,
        reportedUserId,
        transactionId: transactionId || undefined,
        description
      });
    },
    onSuccess: () => {
      alert('Your dispute has been filed successfully. An administrator will review your claim shortly.');
      navigate('/');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to submit dispute report.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    disputeMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back Link */}
      <BackButton />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900 leading-tight">
              File a Dispute / Report
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit a formal report regarding a transaction issue or member behavior
            </p>
          </div>
        </div>

        {/* Warning info card */}
        <div className="flex items-start space-x-3 rounded-2xl bg-amber-50 p-4 border border-amber-100 text-xs text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">Guidelines:</strong> Please describe the issue accurately. If applicable, provide transaction hashes, textbook titles, or exact meeting locations. Administrators review all dispute submissions and will contact participants via email if further evidence is required.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dispute Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Subject / Brief Summary
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Book condition does not match listing or No-show during campus meeting"
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs focus:border-indigo-550 focus:bg-white focus:outline-none shadow-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reported User */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Reported Student (ID or Name)
              </label>
              <input
                type="text"
                value={reportedUserId}
                onChange={(e) => setReportedUserId(e.target.value)}
                placeholder="e.g. Sarah Miller or student_id"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs focus:border-indigo-550 focus:bg-white focus:outline-none shadow-sm"
                required
              />
            </div>

            {/* Transaction ID */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Related Request / Transaction ID (optional)
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. Request ID or book title"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs focus:border-indigo-550 focus:bg-white focus:outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Detailed Description of Issue
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please explain in detail what happened. Include dates, chat details, and exchange agreements..."
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs focus:border-indigo-550 focus:bg-white focus:outline-none shadow-sm"
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={disputeMutation.isPending}
              className="rounded-lg bg-rose-600 bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 transition flex items-center shadow"
            >
              {disputeMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  <span>Submit Dispute</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default Disputes;
