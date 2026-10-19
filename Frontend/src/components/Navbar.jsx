import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Home,
  FileText,
  UploadCloud,
  Users,
  User,
  LogOut,
  Zap,
  ChevronDown
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || user;
    } catch {
      return user;
    }
  })();

  const isAdmin =
    savedUser?.role === 'COMPANY_ADMIN' || savedUser?.role === 'ADMIN';

  const isStaff =
    isAdmin || savedUser?.role === 'EMPLOYEE';

  const getRoleLabel = (role) => {
    switch (role) {
      case 'COMPANY_ADMIN':
        return 'Company Admin';
      case 'ADMIN':
        return 'System Admin';
      case 'EMPLOYEE':
        return 'Staff / Operations';
      case 'POLICYHOLDER':
      default:
        return 'Policyholder';
    }
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Navigation items:
  // - Home, Insurances, AI Advisor (common for all users), Profile
  // - Policy Documents & Upload Document only for Staff/Admin (hidden for Policyholder)
  // - People only for Admin
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'insurance', label: 'Insurances', icon: ShieldCheck },
    { id: 'chat', label: 'AI Advisor', icon: Zap },
    ...(isStaff ? [{ id: 'documents', label: 'Policy Documents', icon: FileText }] : []),
    ...(isStaff ? [{ id: 'upload', label: 'Upload Document', icon: UploadCloud }] : []),
    ...(isAdmin ? [{ id: 'people', label: 'People', icon: Users }] : []),
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer group shrink-0"
            onClick={() => setActiveTab('home')}
          >
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-blue-600 rounded-xl text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white group-hover:text-sky-300 transition-colors">
                Insurance Portal
              </span>
              <p className="text-[11px] text-slate-400">Personal & Family Coverage Advisor</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile Pill & Dropdown Menu (for all user types) */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
              title="Account Menu"
            >
              {/* Round Avatar Icon */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 border border-sky-400/30 flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-sky-500/20 shrink-0 group-hover:scale-105 transition-transform">
                {savedUser?.name ? savedUser.name.charAt(0).toUpperCase() : 'U'}
              </div>

              {/* Name & Role Text */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-tight truncate max-w-[130px] sm:max-w-[160px]">
                  {savedUser?.name || 'User'}
                </span>
                <span className="text-[10px] font-medium text-sky-400 leading-tight">
                  {getRoleLabel(savedUser?.role)}
                </span>
              </div>

              {/* Dropdown Symbol */}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 shrink-0 ${
                  isDropdownOpen ? 'rotate-180 text-sky-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-scale-in backdrop-blur-xl">
                {/* User Summary Header */}
                <div className="px-3.5 py-3 border-b border-slate-800/90 flex items-center space-x-3 bg-slate-950/70 rounded-xl mb-1.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                    {savedUser?.name ? savedUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate">
                      {savedUser?.name || 'User'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono truncate">
                      {savedUser?.email}
                    </span>
                    <span className="text-[10px] text-sky-400 font-semibold mt-0.5">
                      {getRoleLabel(savedUser?.role)}
                    </span>
                  </div>
                </div>

                {/* Dropdown Actions */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setActiveTab('profile');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </button>

                  <div className="my-1 border-t border-slate-800/80" />

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/60 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
