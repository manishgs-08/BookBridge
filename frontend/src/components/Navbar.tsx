import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  Bell, 
  MessageSquare, 
  Heart, 
  List, 
  User as UserIcon, 
  LogOut, 
  Shield, 
  Menu, 
  X,
  Check
} from 'lucide-react';
import api from '../api/axios';

interface Notification {
  _id: string;
  user: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, isVerifiedSeller } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications if logged in
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        // Accept arrays directly or inside data key
        const list = Array.isArray(response.data) ? response.data : (response.data.notifications || []);
        setNotifications(list);
        setUnreadCount(list.filter((n: Notification) => !n.isRead).length);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        throw err;
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition">
              <BookOpen className="h-8 w-8 stroke-[2.5]" />
              <span className="font-display text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
                BookBridge
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          {isAuthenticated && (
            <div className="hidden md:flex space-x-1">
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive('/') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Marketplace
              </Link>
              {isVerifiedSeller && (
                <Link 
                  to="/inventory" 
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive('/inventory') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  My Inventory
                </Link>
              )}
              <Link 
                to="/wishlist" 
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive('/wishlist') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Wishlist
              </Link>
              <Link 
                to="/requests" 
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive('/requests') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Requests
              </Link>
              <Link 
                to="/messages" 
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive('/messages') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Messages
              </Link>
            </div>
          )}

          {/* User Controls & Notifications */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Admin dashboard indicator */}
                {user?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-full transition relative group"
                    title="Admin Dashboard"
                  >
                    <Shield className="h-5 w-5" />
                    <span className="absolute hidden group-hover:block bg-rose-700 text-white text-[10px] py-1 px-2 rounded-md -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      Admin Panel
                    </span>
                  </Link>
                )}

                {/* Notifications Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen);
                      if (mobileMenuOpen) setMobileMenuOpen(false);
                    }}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Card */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white p-2 shadow-premium border border-slate-100 ring-1 ring-black/5 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                        <span className="font-display text-sm font-bold text-slate-950">Notifications</span>
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllRead}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto mt-1 space-y-1">
                        {notifications.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-500">No new notifications</p>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif._id}
                              className={`flex items-start justify-between rounded-lg p-2.5 text-xs transition ${
                                notif.isRead ? 'bg-transparent text-slate-600' : 'bg-indigo-50/50 text-slate-950 font-medium'
                              }`}
                            >
                              <div className="pr-2">
                                <p className="leading-snug">{notif.message}</p>
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {!notif.isRead && (
                                <button 
                                  onClick={() => handleMarkAsRead(notif._id)}
                                  className="text-indigo-600 hover:bg-indigo-100 p-1 rounded transition self-center"
                                  title="Mark as read"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Link & Logout */}
                <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
                  <Link to="/profile" className="flex items-center space-x-2 text-slate-700 hover:text-slate-950 transition">
                    {user?.profile_picture ? (
                      <img 
                        src={user.profile_picture} 
                        alt={user.user_name} 
                        className="h-8 w-8 rounded-full border object-cover" 
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-display text-xs font-bold text-white">
                        {user?.user_name ? user.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                      </div>
                    )}
                    <span className="text-sm font-semibold max-w-[100px] truncate">{user?.user_name}</span>
                  </Link>
                  <button 
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full hover:text-rose-600 transition"
                    title="Log Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link 
                  to="/login" 
                  className="text-sm font-semibold text-slate-700 hover:text-slate-950 px-3 py-2"
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 hover:shadow-premium transition"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden space-y-2 animate-fade-in shadow-lg">
          {isAuthenticated ? (
            <>
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {user?.user_name ? user.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900">{user?.user_name}</h4>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1 pt-2">
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <BookOpen className="h-4 w-4" /> <span>Marketplace</span>
                </Link>
                {isVerifiedSeller && (
                  <Link 
                    to="/inventory" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <List className="h-4 w-4" /> <span>My Inventory</span>
                  </Link>
                )}
                <Link 
                  to="/wishlist" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Heart className="h-4 w-4" /> <span>Wishlist</span>
                </Link>
                <Link 
                  to="/requests" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" /> <span>Requests</span>
                </Link>
                <Link 
                  to="/messages" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <MessageSquare className="h-4 w-4" /> <span>Messages</span>
                </Link>
                <Link 
                  to="/profile" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="h-4 w-4" /> <span>My Profile</span>
                </Link>
                {user?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Shield className="h-4 w-4" /> <span>Admin Panel</span>
                  </Link>
                )}
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 text-left"
                >
                  <LogOut className="h-4 w-4" /> <span>Log Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col space-y-2 pt-2">
              <Link 
                to="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log In
              </Link>
              <Link 
                to="/signup" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
export default Navbar;
