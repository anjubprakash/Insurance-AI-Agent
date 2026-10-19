import React from 'react';
import {
  ShieldCheck,
  UploadCloud,
  FileText,
  ArrowRight,
  Sparkles,
  Bot,
  Users,
  Zap
} from 'lucide-react';

export default function HomePage({ user, onNavigateToTab }) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-sky-950/40 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Insurance Portal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, {savedUser?.name || 'User'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Explore insurance plans across Health, Car & Motor, Home, Life, Personal Accident, and Agriculture,
              chat with our AI Insurance Advisor to find the right coverage for you or your family, and manage your policies in one place.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToTab('chat')}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-xs font-extrabold text-slate-950 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Talk to AI Insurance Advisor</span>
              </button>

              <button
                onClick={() => onNavigateToTab('insurance')}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Browse Insurances</span>
              </button>

              {isStaff && (
                <>
                  <button
                    onClick={() => onNavigateToTab('upload')}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-sky-500/25"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Policy Document</span>
                  </button>

                  <button
                    onClick={() => onNavigateToTab('documents')}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Policy Documents</span>
                  </button>
                </>
              )}

              {isAdmin && (
                <button
                  onClick={() => onNavigateToTab('people')}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-semibold text-purple-300 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>Manage People & Roles</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module 1: AI Insurance Advisor */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between transition-all group shadow-sm">
          <div className="space-y-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              AI Insurance Advisor
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Not sure which insurance is right for you or your family? Chat naturally with our advisor to explore coverage options and recommendations.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigateToTab('chat')}
              className="flex items-center text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors group-hover:translate-x-1 duration-200"
            >
              <span>Start Chatting</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>

        {/* Module 2: Insurance Plans */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between transition-all group shadow-sm">
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Insurance Plans & Enrollment
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Browse Health, Car & Motor, Home, Life, Personal Accident, and Agriculture plans, ask plan-specific questions, or enroll directly.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigateToTab('insurance')}
              className="flex items-center text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group-hover:translate-x-1 duration-200"
            >
              <span>Browse Insurance Plans</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>

        {/* Module 3: My Profile & Policies */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-6 flex flex-col justify-between transition-all group shadow-sm">
          <div className="space-y-3">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
              My Profile & Policies
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              View and manage your personal details, KYC preferences, and your active insurance policies.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigateToTab('profile')}
              className="flex items-center text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors group-hover:translate-x-1 duration-200"
            >
              <span>Open My Profile</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
