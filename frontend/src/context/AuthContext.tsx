import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface User {
  user_id: number;
  user_name: string;
  email: string;
  role: UserRole;
  seller_verified: boolean;
  profile_picture?: string;
  usn?: string | null;
  rating?: number;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
  isVerifiedSeller: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('bookbridge_token');
      const storedUser = localStorage.getItem('bookbridge_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Verify token against backend on startup
        try {
          const response = await api.get('/auth/me');
          const dbUser = response.data?.data;
          if (dbUser) {
            // Normalize MySQL boolean fields (MySQL returns 0/1, not true/false)
            const normalizedUser: User = {
              ...dbUser,
              seller_verified: Boolean(dbUser.seller_verified),
            };
            setUser(normalizedUser);
            localStorage.setItem('bookbridge_user', JSON.stringify(normalizedUser));
          }
        } catch (error) {
          console.error('Failed to verify token', error);
          // If token verification fails with 401, axios interceptor handles it,
          // but if it fails for other reasons (e.g. backend offline), we keep the stored session for offline resiliency
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    // Normalize MySQL boolean fields (MySQL returns 0/1, not true/false)
    const normalizedUser: User = {
      ...newUser,
      seller_verified: Boolean(newUser.seller_verified),
    };
    localStorage.setItem('bookbridge_token', newToken);
    localStorage.setItem('bookbridge_user', JSON.stringify(normalizedUser));
    setToken(newToken);
    setUser(normalizedUser);
  };

  const logout = () => {
    localStorage.removeItem('bookbridge_token');
    localStorage.removeItem('bookbridge_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      localStorage.setItem('bookbridge_user', JSON.stringify(updatedUser));
    }
  };

  const isAuthenticated = !!token;
  const isVerifiedSeller = user?.role === 'seller' && user?.seller_verified === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        updateUser,
        isVerifiedSeller,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
