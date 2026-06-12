import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, AlertCircle } from 'lucide-react';

export const Signup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Catch OAuth errors passed via redirect query params
    const errParam = searchParams.get('error');
    if (errParam === 'oauth_failed') {
      setError('Google Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'https://bookbridge-production-68a5.up.railway.app/api';
    // Redirect browser directly to Google OAuth initiation endpoint
    window.location.href = `${backendUrl}/auth/google`;
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-premium border border-slate-100">
        {/* Title Block */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-650 mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
            Create Account
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Join BookBridge to trade books at your campus
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 p-3.5 text-sm text-rose-600 border border-rose-100">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          <p className="text-center text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
            By signing up with Google, BookBridge automatically registers your student profile. Only university email addresses are eligible to participate.
          </p>

          {/* Google OAuth Signup Button */}
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center space-x-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-350 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-550 cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.358-2.848-6.358-6.358S10.485 5.8 13.995 5.8c1.517 0 2.9.535 3.985 1.417l3.056-3.056C19.18 2.502 16.735 1.5 13.995 1.5 8.256 1.5 3.6 6.156 3.6 11.895S8.256 22.29 13.995 22.29c5.688 0 9.85-4 9.85-9.85 0-.61-.065-1.2-.185-1.758H12.24z"
              />
            </svg>
            <span>Sign Up with Google</span>
          </button>
        </div>

        {/* Login Redirect Link */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 transition">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
