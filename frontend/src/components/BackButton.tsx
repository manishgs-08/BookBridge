import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const BackButton: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    // If there is history, go back. Otherwise fallback to home.
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button 
      onClick={handleBack}
      className="inline-flex items-center space-x-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition mb-4 group"
    >
      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
      <span>Back</span>
    </button>
  );
};
