import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Car,
  Home,
  Briefcase,
  Users,
  Shield,
  Zap,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Sparkles,
  Layers,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { createPolicyApi } from '../api/policy.api.js';
import { queryAgentApi, listPolicyOffersApi, deletePolicyOfferApi } from '../api/documents.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import { isPlanFavorite, togglePlanFavorite } from '../utils/favorites.js';
import ChatMessageRenderer from '../components/ChatMessageRenderer.jsx';

const CATEGORY_THEME_MAP = {
  HEALTH: {
    label: 'Health Insurance',
    icon: Heart,
    borderColor: 'border-emerald-500/30',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  AUTO: {
    label: 'Car & Motor',
    icon: Car,
    borderColor: 'border-blue-500/30',
    badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
  },
  HOME: {
    label: 'Home Insurance',
    icon: Home,
    borderColor: 'border-amber-500/30',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  LIFE: {
    label: 'Life Insurance',
    icon: Users,
    borderColor: 'border-purple-500/30',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
  },
  COMMERCIAL: {
    label: 'Commercial Business',
    icon: Briefcase,
    borderColor: 'border-indigo-500/30',
    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
  },
  ACCIDENT: {
    label: 'Personal Accident',
    icon: Shield,
    borderColor: 'border-teal-500/30',
    badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
  },
  AGRICULTURE: {
    label: 'Agriculture Cover',
    icon: Shield,
    borderColor: 'border-emerald-500/30',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  TRAVEL: {
    label: 'Travel Insurance',
    icon: Shield,
    borderColor: 'border-cyan-500/30',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  },
  LIABILITY: {
    label: 'Liability & D&O',
    icon: Briefcase,
    borderColor: 'border-rose-500/30',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  },
  GENERAL: {
    label: 'General Insurance',
    icon: Shield,
    borderColor: 'border-sky-500/30',
    badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  }
};

const getCategoryTheme = (code) => {
  const normalized = (code || 'GENERAL').toUpperCase();
  return (
    CATEGORY_THEME_MAP[normalized] || {
      label: `${normalized.charAt(0) + normalized.slice(1).toLowerCase()}`,
      icon: Shield,
      borderColor: 'border-sky-500/30',
      badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    }
  );
};

const formatCurrency = (val) => {
  if (!val) return 'Standard Limit';
  const str = String(val).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    return `£${Number(str).toLocaleString()}`;
  }
  return str;
};

/**
 * InsurancePage Component
 *
 * Displays all available insurance plans organized by category filter.
 * Clicking "Talk to Agent ⚡" on any plan opens a dedicated AI Advisor chat
 * strictly for THAT single insurance plan—never mixing in other plans or categories.
 */
export default function InsurancePage({ user, onNavigateToTab }) {
  const { user: authUser, updateUserSession } = useAuth();
  const effectiveUser = authUser || user;
  const isAdmin = effectiveUser?.role === 'ADMIN' || effectiveUser?.role === 'COMPANY_ADMIN';

  const [offerToDelete, setOfferToDelete] = useState(null);
  const [isDeletingOffer, setIsDeletingOffer] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [offers, setOffers] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingCatalog(true);
      try {
        const res = await listPolicyOffersApi({ limit: 200 });
        setOffers(res.data?.offers || []);
      } catch (_) {
      } finally {
        setLoadingCatalog(false);
      }
    };
    fetchPlans();
  }, []);

  const [toast, setToast] = useState(null);

  // Plan-Specific AI Chat state (locked to a single insurance plan)
  const [activeChatOffer, setActiveChatOffer] = useState(null);
  const [agentChatMessages, setAgentChatMessages] = useState([]);
  const [agentChatInput, setAgentChatInput] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Enroll Modal state
  const [enrollmentOffer, setEnrollmentOffer] = useState(null);
  const [enrollmentForm, setEnrollmentForm] = useState({
    policyName: '',
    insuranceType: '',
    whoIsInsured: 'SELF',
    coveredAge: effectiveUser?.age || '',
    sumInsured: '',
    policyTerm: '1 Year',
    premium: '',
    deductible: '',
    nomineeName: '',
    nomineeRelationship: ''
  });
  const [isEnrolling, setIsEnrolling] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /**
   * Confirms and deletes a policy offer from MongoDB and Qdrant vectors
   */
  const handleConfirmDeleteOffer = async () => {
    if (!offerToDelete) return;
    setIsDeletingOffer(true);
    try {
      await deletePolicyOfferApi(offerToDelete._id);
      setOffers((prev) => prev.filter((o) => o._id !== offerToDelete._id));
      showToast(
        `Permanently deleted "${offerToDelete.planName}" (${offerToDelete.policyReferenceCode}) from MongoDB and Qdrant.`,
        'success'
      );
      setOfferToDelete(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete insurance plan offer', 'error');
    } finally {
      setIsDeletingOffer(false);
    }
  };

  const [, setFavUpdateTrigger] = useState(0);

  useEffect(() => {
    const handleFavChange = () => setFavUpdateTrigger((c) => c + 1);
    window.addEventListener('insurance_favorites_changed', handleFavChange);
    return () => window.removeEventListener('insurance_favorites_changed', handleFavChange);
  }, []);

  /**
   * Toggles favorite status for a policy plan
   */
  const handleToggleFavorite = (offer, e) => {
    e?.stopPropagation();
    const res = togglePlanFavorite(effectiveUser?._id, offer);
    setFavUpdateTrigger((c) => c + 1);
    showToast(
      res.isFav
        ? `Added "${offer.planName}" to your Favorites ❤️`
        : `Removed "${offer.planName}" from Favorites`,
      'success'
    );
  };

  // Dynamic category filter buttons derived from available plans
  const categoryFilters = useMemo(() => {
    const counts = {};
    offers.forEach((o) => {
      const cat = (o.policyCategory || 'GENERAL').toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const dynamicTabs = Object.keys(counts).map((code) => ({
      id: code,
      label: `${getCategoryTheme(code).label} (${counts[code]})`
    }));

    return [{ id: 'ALL', label: `All Categories (${offers.length})` }, ...dynamicTabs];
  }, [offers]);

  // Filter plans by selected category & search input
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const code = (offer.policyCategory || 'GENERAL').toUpperCase();
      if (selectedFilter !== 'ALL' && code !== selectedFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (offer.planName || '').toLowerCase().includes(q) ||
          (offer.insurer || '').toLowerCase().includes(q) ||
          (offer.coverageSubtype || '').toLowerCase().includes(q) ||
          (offer.benefitSublimits || '').toLowerCase().includes(q) ||
          (offer.policyCategory || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [offers, selectedFilter, searchQuery]);

  /**
   * Opens the AI Advisor Chat locked strictly to ONE specific insurance plan
   */
  const handleOpenPlanChat = (offer) => {
    if (!offer) return;
    setActiveChatOffer(offer);
    setAgentChatInput('');
    setAgentChatMessages([
      {
        sender: 'agent',
        text: `Hello ${
          effectiveUser?.name ? effectiveUser.name.split(' ')[0] : 'there'
        }! ⚡ I am your dedicated advisor for **${offer.planName}** (${offer.insurer}).\n\nAsk me anything about **${
          offer.planName
        }**—including how much coverage it provides, monthly pricing, deductibles, waiting periods, exclusions, or how to file a claim.`
      }
    ]);
  };

  /**
   * Sends a question scoped strictly to the selected insurance plan (`activeChatOffer`)
   */
  const handleSendAgentMessage = async (customQuestion) => {
    const questionText = (customQuestion || agentChatInput).trim();
    if (!questionText || isAgentThinking || !activeChatOffer) return;

    const historyForApi = agentChatMessages
      .slice(1)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    setAgentChatMessages((prev) => [...prev, { sender: 'user', text: questionText }]);
    setAgentChatInput('');
    setIsAgentThinking(true);

    try {
      const res = await queryAgentApi({
        question: questionText,
        policyTypeFilter: activeChatOffer.policyCategory,
        policyCodeFilter: activeChatOffer.policyReferenceCode,
        planNameFilter: activeChatOffer.planName,
        conversationHistory: historyForApi
      });

      const reply =
        res.data?.answer ||
        `I can help you with questions about ${activeChatOffer.planName}'s coverage, pricing, deductibles, waiting periods, exclusions, and claims.`;

      setAgentChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: reply
        }
      ]);
    } catch (err) {
      setAgentChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text:
            err.message ||
            'Unable to reach the advisor right now. Please try again in a moment.'
        }
      ]);
    } finally {
      setIsAgentThinking(false);
    }
  };

  /**
   * Opens Enrollment Modal for a specific insurance plan
   */
  const handleOpenEnrollment = (offer) => {
    setEnrollmentOffer(offer);
    setEnrollmentForm({
      policyName: offer.planName,
      insuranceType: (offer.policyCategory || 'HEALTH').toUpperCase(),
      whoIsInsured: 'SELF',
      coveredAge: effectiveUser?.age || '',
      sumInsured: formatCurrency(offer.annualCoverageAmount),
      policyTerm: '1 Year',
      premium: offer.illustrativePremium || '',
      deductible: offer.excessDeductible || '',
      nomineeName: '',
      nomineeRelationship: ''
    });
  };

  /**
   * Submits Enrollment & links policy to current user
   */
  const handleSubmitEnrollment = async (e) => {
    e.preventDefault();
    setIsEnrolling(true);
    try {
      const res = await createPolicyApi(enrollmentForm);
      const createdPolicy = res.data;

      if (createdPolicy?.userId) {
        updateUserSession({
          ...effectiveUser,
          policies: [
            ...(effectiveUser.policies || []),
            {
              policyId: createdPolicy._id,
              policyName: createdPolicy.policyName
            }
          ]
        });
      }

      setEnrollmentOffer(null);
      showToast(`Enrolled in "${createdPolicy.policyName}" successfully!`, 'success');

      if (onNavigateToTab) {
        setTimeout(() => onNavigateToTab('profile'), 1500);
      }
    } catch (err) {
      showToast(err.message || 'Failed to enroll policy', 'error');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border flex items-center space-x-2 shadow-2xl backdrop-blur-md transition-all text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-sky-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Insurance Plans & Coverage
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {offers.length} Plans Available
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Explore Insurance Plans by Category
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Filter by category to view individual insurance plans. Click{' '}
              <span className="text-amber-300 font-bold">Talk to Agent ⚡</span> on any plan to ask questions specifically about that policy, or enroll directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('profile')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-2 border border-slate-700 transition-all shrink-0"
            >
              <Layers className="w-4 h-4 text-sky-400" />
              <span>My Subscribed Policies</span>
            </button>
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilters.map((cat) => {
              const isActive = selectedFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedFilter(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/25'
                      : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plan name, provider, or benefit..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loadingCatalog ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading insurance plans...</p>
        </div>
      ) : (
        <>
          {/* Individual Insurance Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer) => {
              const theme = getCategoryTheme(offer.policyCategory);
              const Icon = theme.icon;

              return (
                <div
                  key={offer._id || offer.policyReferenceCode}
                  className={`bg-slate-900/90 border ${theme.borderColor} hover:border-slate-700 rounded-2xl p-6 space-y-5 flex flex-col justify-between transition-all group shadow-xl hover:shadow-2xl`}
                >
                  <div className="space-y-4">
                    {/* Plan Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-3 bg-slate-950 rounded-2xl text-white border border-slate-800 shadow-md shrink-0">
                          <Icon className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors truncate">
                            {offer.planName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span
                              className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold border ${theme.badgeColor}`}
                            >
                              {theme.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {offer.insurer}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Love / Favorite Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(offer, e)}
                          className={`p-2 rounded-xl transition-all cursor-pointer shadow-sm border ${
                            isPlanFavorite(effectiveUser?._id, offer)
                              ? 'bg-rose-500/20 text-rose-500 border-rose-500/40 shadow-rose-500/20'
                              : 'bg-slate-950/60 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-slate-800'
                          }`}
                          title={isPlanFavorite(effectiveUser?._id, offer) ? "Remove from Favorites" : "Add to Favorites ❤️"}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform active:scale-125 ${
                              isPlanFavorite(effectiveUser?._id, offer) ? 'fill-rose-500 text-rose-500' : ''
                            }`}
                          />
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOfferToDelete(offer);
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800/80 hover:border-red-500/30 transition-all cursor-pointer shrink-0 shadow-sm"
                            title="Delete Plan (Purges DB and Qdrant vectors)"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Coverage Summary Strip */}
                    <div className="grid grid-cols-2 gap-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Coverage Limit
                        </span>
                        <span className="text-sm font-extrabold text-emerald-400 font-mono">
                          {formatCurrency(offer.annualCoverageAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Monthly Premium
                        </span>
                        <span className="text-sm font-bold text-white">
                          {offer.illustrativePremium || 'Contact for quote'}
                        </span>
                      </div>
                    </div>

                    {/* Key Plan Details */}
                    <div className="bg-slate-950/50 border border-slate-800/70 rounded-xl p-3.5 space-y-2 text-xs">
                      {offer.coverageSubtype && (
                        <div className="flex items-start space-x-1.5 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-200">Plan Type:</strong> {offer.coverageSubtype}
                          </span>
                        </div>
                      )}
                      {offer.benefitSublimits && (
                        <div className="flex items-start space-x-1.5 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-200">Benefits:</strong> {offer.benefitSublimits}
                          </span>
                        </div>
                      )}
                      {offer.excessDeductible && (
                        <div className="flex items-start space-x-1.5 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-200">Deductible:</strong> {offer.excessDeductible}
                          </span>
                        </div>
                      )}
                      {offer.waitingPeriods && (
                        <div className="flex items-start space-x-1.5 text-[11px] text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-200">Waiting Period:</strong> {offer.waitingPeriods}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Glowing "Talk to Agent ⚡" for THIS plan + "Enroll in Plan" */}
                  <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() =>
                        onNavigateToTab
                          ? onNavigateToTab('chat', { targetOffer: offer, forceNewChat: true })
                          : handleOpenPlanChat(offer)
                      }
                      className="relative inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 shadow-[0_0_20px_rgba(245,158,11,0.7)] hover:shadow-[0_0_30px_rgba(245,158,11,1)] hover:scale-105 active:scale-95 transition-all duration-300 border border-yellow-300/60 cursor-pointer"
                      title={`Ask Advisor about ${offer.planName}`}
                    >
                      <Zap className="w-4 h-4 fill-slate-950 text-slate-950 stroke-[2.5]" />
                      <span className="tracking-wide uppercase font-extrabold text-[11px]">
                        Talk to Agent
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEnrollment(offer)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Enroll</span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfferToDelete(offer);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all shadow-sm cursor-pointer"
                          title="Delete Plan (Purges DB and Qdrant vectors)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOffers.length === 0 && (
            <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-3">
              <p className="text-sm font-bold text-white">No Insurance Plans Found</p>
              <p className="text-xs text-slate-400">
                No plans match "{searchQuery}" under the selected category.
              </p>
              {(selectedFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-sky-500 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          MODAL 1: DEDICATED SINGLE-PLAN AI ADVISOR CHAT
         ========================================================================= */}
      {activeChatOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-2xl h-[640px] shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.5)] shrink-0">
                  <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {activeChatOffer.planName}
                  </h3>
                  <p className="text-[11px] text-amber-300/90 font-medium truncate">
                    {activeChatOffer.insurer} • {getCategoryTheme(activeChatOffer.policyCategory).label} • Coverage up to {formatCurrency(activeChatOffer.annualCoverageAmount)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveChatOffer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
              {agentChatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none shadow-md'
                        : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center space-x-1 mb-1 text-[10px] opacity-80 font-bold">
                      {msg.sender === 'user' ? (
                        <span>You</span>
                      ) : (
                        <span className="flex items-center text-amber-400">
                          <Zap className="w-3 h-3 mr-1 fill-amber-400 inline" />
                          {activeChatOffer.planName} Advisor
                        </span>
                      )}
                    </div>
                    {msg.sender === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                      <ChatMessageRenderer content={msg.text} />
                    )}
                  </div>
                </div>
              ))}

              {isAgentThinking && (
                <div className="flex justify-start">
                  <div className="bg-slate-950/90 border border-slate-800 text-amber-300 rounded-2xl rounded-bl-none px-4 py-3 text-xs flex items-center space-x-2 animate-pulse">
                    <Zap className="w-4 h-4 fill-amber-400 animate-bounce" />
                    <span>Checking {activeChatOffer.planName} policy details...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center space-x-2">
              <input
                type="text"
                value={agentChatInput}
                onChange={(e) => setAgentChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAgentMessage()}
                disabled={isAgentThinking}
                placeholder={`Ask a question about ${activeChatOffer.planName}...`}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
              />
              <button
                onClick={() => handleSendAgentMessage()}
                disabled={isAgentThinking || !agentChatInput.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all disabled:opacity-40"
              >
                <span>Ask</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ENROLL IN PLAN MODAL
         ========================================================================= */}
      {enrollmentOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center space-x-2.5">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Enroll in {enrollmentOffer.planName}
                </h3>
              </div>
              <button
                onClick={() => setEnrollmentOffer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEnrollment} className="p-6 space-y-4 text-xs">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={enrollmentForm.policyName}
                    onChange={(e) => setEnrollmentForm((p) => ({ ...p, policyName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Who Is Insured</label>
                    <select
                      value={enrollmentForm.whoIsInsured}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, whoIsInsured: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SELF">Self</option>
                      <option value="SPOUSE">Spouse</option>
                      <option value="PARENTS">Parents</option>
                      <option value="CHILD">Child</option>
                      <option value="FAMILY">Family (Floater)</option>
                      <option value="BUSINESS">Business</option>
                      <option value="ASSET">Asset / Vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Sum Insured</label>
                    <input
                      type="text"
                      value={enrollmentForm.sumInsured}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, sumInsured: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Policy Term</label>
                    <input
                      type="text"
                      value={enrollmentForm.policyTerm}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, policyTerm: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Premium</label>
                    <input
                      type="text"
                      value={enrollmentForm.premium}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, premium: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Nominee Full Name</label>
                    <input
                      type="text"
                      value={enrollmentForm.nomineeName}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, nomineeName: e.target.value }))}
                      placeholder="Nominee name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Relationship</label>
                    <input
                      type="text"
                      value={enrollmentForm.nomineeRelationship}
                      onChange={(e) => setEnrollmentForm((p) => ({ ...p, nomineeRelationship: e.target.value }))}
                      placeholder="Relationship"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEnrollmentOffer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEnrolling}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isEnrolling ? 'Enrolling...' : 'Confirm & Link Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(offerToDelete)}
        onClose={() => !isDeletingOffer && setOfferToDelete(null)}
        onConfirm={handleConfirmDeleteOffer}
        title="Delete Insurance Plan Offer?"
        itemTitle={offerToDelete?.planName}
        itemCode={offerToDelete?.policyReferenceCode}
        itemType="Insurance Plan Offer"
        isDeleting={isDeletingOffer}
      />
    </div>
  );
}
