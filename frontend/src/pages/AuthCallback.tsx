import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';

// Module-level cache to prevent duplicate requests in React 18/19 StrictMode
let activeExchangePromise: Promise<any> | null = null;
let activeExchangeCode: string | null = null;

export const AuthCallback: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const exchangeCode = async () => {
      const code = searchParams.get('code');

      if (!code) {
        if (isCurrent) {
          setError('Authorization code is missing. Please try signing in again.');
          setTimeout(() => navigate('/login'), 3000);
        }
        return;
      }

      try {
        // Reuse or create exchange promise to prevent duplicate API requests
        if (activeExchangePromise === null || activeExchangeCode !== code) {
          activeExchangeCode = code;
          activeExchangePromise = api.post('/auth/exchange', { code });
        }

        const response = await activeExchangePromise;
        if (!isCurrent) return;

        // Since backend wraps in { success, message, data: { token, user } }
        const dataPayload = response.data?.data;
        const token = dataPayload?.token;
        const dbUser = dataPayload?.user;

        if (token && dbUser) {
          login(token, dbUser);
          navigate('/');
        } else {
          throw new Error('Authentication response is missing token or user data.');
        }
      } catch (err: any) {
        if (!isCurrent) return;
        console.error('Failed to exchange OAuth code:', err);
        setError(
          err.response?.data?.message || 
          'Authentication failed. Please verify that you are using a university email address.'
        );
        setTimeout(() => navigate('/login'), 4000);
      }
    };

    exchangeCode();

    return () => {
      isCurrent = false;
    };
  }, [searchParams, login, navigate]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-premium border border-slate-100 text-center">
        {error ? (
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4 animate-bounce">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Authentication Error
            </h2>
            <p className="mt-4 text-sm text-rose-600 font-semibold bg-rose-50 p-4 rounded-xl border border-rose-100">
              {error}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Redirecting you to the login page...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-indigo-650 animate-spin mb-4" />
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Connecting with Google
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Verifying your credentials and logging you in...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
