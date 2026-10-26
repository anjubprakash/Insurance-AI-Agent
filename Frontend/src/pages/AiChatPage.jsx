import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Send,
  Trash2,
  Bot,
  ShieldCheck,
  Sparkles,
  Info,
  Plus,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Clock,
  Search,
  Heart
} from 'lucide-react';
import { queryAgentApi } from '../api/documents.api.js';
import { getMyPoliciesApi } from '../api/policy.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PlanDetailsModal from '../components/PlanDetailsModal.jsx';
import { isPlanFavorite, togglePlanFavorite } from '../utils/favorites.js';
import ChatMessageRenderer from '../components/ChatMessageRenderer.jsx';

const formatAmount = (val) => {
  if (!val) return 'Not specified';
  const str = String(val).trim();
  return /^\d+(\.\d+)?$/.test(str) ? `£${Number(str).toLocaleString('en-GB')}` : str;
};

export default function AiChatPage({ initialContext = null, onClearInitialContext = null }) {
  const { user, updateUserSession } = useAuth();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeSavedPolicy, setActiveSavedPolicy] = useState(null);
  const [allUserPolicies, setAllUserPolicies] = useState([]);
  const [selectedOfferForModal, setSelectedOfferForModal] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const messagesEndRef = useRef(null);

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';
  const sessionsStorageKey = user?._id
    ? `insurance_chat_sessions_${user._id}`
    : 'insurance_chat_sessions_guest';
  const legacyStorageKey = user?._id
    ? `insurance_chat_history_${user._id}`
    : 'insurance_chat_history_guest';

  const createInitialGreeting = () => ({
    sender: 'agent',
    text: `Hello ${firstName}! 👋 I'm your AI Insurance Advisor. How can I help you today? Tell me what type of insurance you are looking for (such as Health, Car/Motor, Home, Life, Personal Accident, Agriculture, or Commercial).`,
    recommendedOffers: []
  });

  const createNewSession = () => ({
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [createInitialGreeting()]
  });

  // Initialize sessions from localStorage (with automatic legacy single-chat migration)
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(sessionsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      // Check legacy single-chat history and migrate if present
      const legacy = localStorage.getItem(legacyStorageKey);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const firstUserMsg = parsedLegacy.find((m) => m.sender === 'user')?.text || '';
          const legacySession = {
            id: `chat_${Date.now()}`,
            title: firstUserMsg ? (firstUserMsg.length > 30 ? firstUserMsg.slice(0, 30) + '...' : firstUserMsg) : 'Previous Conversation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: parsedLegacy
          };
          return [legacySession];
        }
      }
    } catch {
      // ignore
    }
    return [createNewSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || '';
  });

  // Always ensure active session exists
  useEffect(() => {
    if (!sessions.some((s) => s.id === activeSessionId)) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        const fresh = createNewSession();
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    }
  }, [sessions, activeSessionId]);

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      if (sessions && sessions.length > 0) {
        localStorage.setItem(sessionsStorageKey, JSON.stringify(sessions));
      }
    } catch {
      // ignore
    }
  }, [sessions, sessionsStorageKey]);

  // Load user-specific policies
  const fetchPolicies = async () => {
    try {
      const res = await getMyPoliciesApi();
      const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      if (list.length >= 0) {
        setAllUserPolicies(list);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Active session object and messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || createNewSession();
  const messages = activeSession.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const [, setFavUpdateTrigger] = useState(0);

  useEffect(() => {
    const handleFavChange = () => setFavUpdateTrigger((c) => c + 1);
    window.addEventListener('insurance_favorites_changed', handleFavChange);
    return () => window.removeEventListener('insurance_favorites_changed', handleFavChange);
  }, []);

  const handleToggleFavorite = (offer, e) => {
    e?.stopPropagation();
    togglePlanFavorite(user?._id, offer);
    setFavUpdateTrigger((c) => c + 1);
  };

  // Start a new chat session (ChatGPT-style "+ New Chat")
  const handleNewChat = () => {
    const fresh = createNewSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setActiveSavedPolicy(null);
    setInput('');
  };

  // Handle incoming navigation context (e.g. from navbar "AI Advisor" or policy card "Talk to Advisor ⚡")
  useEffect(() => {
    if (!initialContext) return;

    if (initialContext.targetOffer) {
      const offer = initialContext.targetOffer;
      const targetCode = (offer.policyReferenceCode || initialContext.targetPolicyNumber || '').trim();
      const targetName = (offer.planName || offer.policyName || '').trim();
      const targetCategory = (offer.policyCategory || offer.insuranceType || '').trim();

      // Check if a dedicated or matching session already exists for this exact policy offer
      const existingSession = sessions.find((s) => {
        // 1. Direct code or policy number match
        if (targetCode) {
          if (s.targetOfferCode && s.targetOfferCode.toUpperCase() === targetCode.toUpperCase()) return true;
          if (s.targetPolicyNumber && s.targetPolicyNumber.toUpperCase() === targetCode.toUpperCase()) return true;
        }
        // 2. Plan name or title match
        if (targetName && targetName.length > 3) {
          const normTarget = targetName.toLowerCase();
          if (s.targetPlanName && s.targetPlanName.toLowerCase() === normTarget) return true;
          if (s.title && s.title.toLowerCase() === normTarget) return true;
          if (s.title && s.title.toLowerCase().includes(normTarget)) return true;
        }
        // 3. Search inside session messages
        if (s.messages && Array.isArray(s.messages)) {
          if (targetCode && s.messages.some((m) => m.text && m.text.toUpperCase().includes(targetCode.toUpperCase()))) {
            return true;
          }
          if (s.messages.some((m) =>
            m.savedPolicy && (
              (targetCode && m.savedPolicy.policyNumber?.toUpperCase() === targetCode.toUpperCase()) ||
              (targetName && m.savedPolicy.policyName?.toLowerCase() === targetName.toLowerCase())
            )
          )) {
            return true;
          }
          if (targetName && targetName.length > 5 && s.messages.some((m) => m.text && m.text.toLowerCase().includes(targetName.toLowerCase()))) {
            return true;
          }
        }
        return false;
      });

      if (existingSession) {
        setActiveSessionId(existingSession.id);
        // Ensure policy identifier tags are recorded on the session
        setSessions((prev) =>
          prev.map((s) =>
            s.id === existingSession.id
              ? {
                  ...s,
                  targetOfferCode: s.targetOfferCode || targetCode,
                  targetPolicyNumber: s.targetPolicyNumber || targetCode,
                  targetPlanName: s.targetPlanName || targetName,
                  targetOffer: s.targetOffer || offer
                }
              : s
          )
        );
      } else {
        const planSession = {
          id: `chat_policy_${targetCode || Date.now()}_${Date.now()}`,
          title: targetName || `Policy #${targetCode}`,
          targetOfferCode: targetCode,
          targetPolicyNumber: targetCode,
          targetPlanName: targetName,
          targetOffer: offer,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              sender: 'agent',
              text: `👋 Hello ${firstName}! I am your dedicated AI Advisor for **${targetName || 'your policy'}** (${offer.insurer || targetCategory || 'Coverage'}).\n\nAsk me anything about this policy's coverage details, waiting periods, claims process, or how to update your details!`,
              recommendedOffers: []
            }
          ]
        };
        setSessions((prev) => [planSession, ...prev]);
        setActiveSessionId(planSession.id);
      }
      setActiveSavedPolicy(null);
      setInput('');
      onClearInitialContext?.();
    } else if (initialContext.forceNewChat) {
      // User clicked "AI Advisor" from Navbar - always open a fresh new chat session!
      handleNewChat();
      onClearInitialContext?.();
    }
  }, [initialContext]);

  // Switch to an existing chat session
  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    setActiveSavedPolicy(null);
  };

  // Delete a single chat session
  const handleDeleteSession = (sessionId, e) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createNewSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Clear all chats
  const handleClearAllChats = () => {
    try {
      localStorage.removeItem(sessionsStorageKey);
      localStorage.removeItem(legacyStorageKey);
    } catch {
      // ignore
    }
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setActiveSavedPolicy(null);
  };

  // Send message in current active session
  const handleSendMessage = async (customQuestion) => {
    const questionText = (customQuestion || input).trim();
    if (!questionText || isThinking) return;

    const historyForApi = messages
      .slice(1)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    // Generate auto-title for new conversation on first user query
    const isFirstUserTurn = !messages.some((m) => m.sender === 'user');
    const newTitle = isFirstUserTurn
      ? (questionText.length > 28 ? questionText.slice(0, 28).trim() + '...' : questionText.trim())
      : activeSession.title;

    const userMsg = { sender: 'user', text: questionText };

    // Optimistically append user message & update title
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            title: s.title === 'New Conversation' ? newTitle : s.title,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, userMsg]
          };
        }
        return s;
      })
    );

    if (!customQuestion) setInput('');
    setIsThinking(true);

    try {
      const targetOfferCode = activeSession.targetOfferCode || null;
      const targetPlanName = activeSession.targetPlanName || null;
      const targetCategory = activeSession.targetOffer?.policyCategory || null;

      const res = await queryAgentApi({
        question: questionText,
        conversationHistory: historyForApi,
        policyCodeFilter: targetOfferCode,
        planNameFilter: targetPlanName,
        policyTypeFilter: targetCategory
      });

      const data = res.data || {};
      const answer = data.answer || 'How can I help you with your insurance needs today?';

      if (data.savedPolicy) {
        setActiveSavedPolicy(data.savedPolicy);
      }

      if (Array.isArray(data.userPolicies)) {
        setAllUserPolicies(data.userPolicies);
      } else {
        fetchPolicies();
      }

      if (data.updatedUser && updateUserSession) {
        updateUserSession(data.updatedUser);
      }

      const agentMsg = {
        sender: 'agent',
        text: answer,
        recommendedOffers: data.recommendedOffers || [],
        savedPolicy: data.savedPolicy || null,
        latencyMs: data.metrics?.latencyMs || data.durationMs || null
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              targetPolicyNumber: data.savedPolicy?.policyNumber || s.targetPolicyNumber,
              targetPlanName: data.savedPolicy?.policyName || s.targetPlanName,
              messages: [...s.messages, agentMsg]
            };
          }
          return s;
        })
      );
    } catch (err) {
      const errorMsg = {
        sender: 'agent',
        text: err.message || 'Unable to reach the advisor right now. Please try again.',
        recommendedOffers: []
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: [...s.messages, errorMsg]
            };
          }
          return s;
        })
      );
    } finally {
      setIsThinking(false);
    }
  };

  // Format session date nicely
  const formatSessionTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now - d;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (diffHours < 48 && d.getDate() === now.getDate() - 1) {
        return 'Yesterday';
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Filtered session list for search
  const filteredSessions = sessions.filter((s) => {
    if (!historySearch.trim()) return true;
    return s.title?.toLowerCase().includes(historySearch.toLowerCase().trim());
  });

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 h-[calc(100vh-95px)] min-h-[600px] flex gap-3 animate-fade-in">
      {/* ChatGPT-Style Left Sidebar: Old Chats & New Chat Button */}
      <aside
        className={`${
          isSidebarOpen ? 'w-72 sm:w-80 flex' : 'hidden'
        } flex-col shrink-0 bg-slate-950/95 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 z-10`}
      >
        {/* Sidebar Top: Prominent + New Chat Button */}
        <div className="p-3.5 border-b border-slate-800/80 bg-slate-950 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Chat History</span>
            </span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors lg:hidden cursor-pointer"
              title="Close history sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-between transition-all shadow-md group cursor-pointer hover:border-amber-400 hover:scale-[1.01]"
            title="Start a new insurance conversation"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400 group-hover:rotate-90 transition-transform" />
              <span>New Chat</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono">
              +
            </span>
          </button>

          {/* Quick Search across Old Chats */}
          {sessions.length > 3 && (
            <div className="relative mt-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search chats..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Sessions List (Old Chats) */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-500 text-xs">
              {historySearch ? 'No chats match your search' : 'No previous chats yet'}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSession.id;
              const sessionTime = formatSessionTime(session.updatedAt || session.createdAt);

              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-slate-900 border-amber-500/50 text-white shadow-sm shadow-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                    {session.targetOfferCode ? (
                      <Zap
                        className={`w-3.5 h-3.5 shrink-0 fill-amber-400 ${
                          isActive ? 'text-amber-400' : 'text-amber-500/70 group-hover:text-amber-400'
                        }`}
                      />
                    ) : (
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                      />
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate font-medium text-xs text-slate-200">
                          {session.title || 'Conversation'}
                        </span>
                        {session.targetOfferCode && (
                          <span className="text-[9px] font-mono px-1 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
                            #{session.targetOfferCode}
                          </span>
                        )}
                      </div>
                      {sessionTime && (
                        <span className="text-[10px] text-slate-500 leading-tight">
                          {sessionTime}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete individual chat button */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer shrink-0"
                    title="Delete this chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Clear History & Count */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>{sessions.length} {sessions.length === 1 ? 'chat' : 'chats'} saved</span>
          {sessions.length > 0 && (
            <button
              onClick={handleClearAllChats}
              className="hover:text-red-400 transition-colors cursor-pointer text-[10px] flex items-center gap-1"
              title="Clear all saved chat history"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl min-w-0">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer shrink-0"
              title={isSidebarOpen ? 'Collapse chat history' : 'Open chat history'}
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0">
              <Bot className="w-4 h-4 text-amber-400" />
            </div>

            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                <span className="truncate">{activeSession.title || 'AI Insurance Advisor'}</span>
                {activeSession.targetOfferCode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    Dedicated Advisor • #{activeSession.targetOfferCode}
                  </span>
                )}
                {activeSavedPolicy?.status === 'ACTIVE' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                    Policy: {activeSavedPolicy.policyNumber}
                  </span>
                )}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {activeSession.targetPlanName
                  ? `Dedicated advisor for ${activeSession.targetPlanName} (${activeSession.targetOffer?.insurer || 'Plan'})`
                  : 'Explore coverage limits, quotes, or catch up with your existing policies'}
              </p>
            </div>
          </div>
        </div>

        {/* Catch-Up Bar for Enrolled Policies (Active Only) */}
        {allUserPolicies && allUserPolicies.filter((p) => p.status === 'ACTIVE').length > 0 && (
          <div className="px-5 py-2 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between gap-3 overflow-x-auto text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">Your Enrolled Policies:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {allUserPolicies
                .filter((p) => p.status === 'ACTIVE')
                .map((p, pIdx) => (
                <button
                  key={p._id || pIdx}
                  onClick={() =>
                    handleSendMessage(
                      `Tell me all details, coverage limit, and benefits of my enrolled policy ${
                        p.policyNumber ? `#${p.policyNumber}` : ''
                      } (${p.policyName || 'Plan'}) for ${
                        p.insuredName || p.whoIsInsured || 'me'
                      }.`
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 font-mono text-[10px] flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                  title="Click to catch up and chat with the advisor about this policy"
                >
                  <span className="font-bold">
                    {p.policyNumber ? `#${p.policyNumber}` : `Policy ${pIdx + 1}`}
                  </span>
                  <span className="text-slate-300 font-sans truncate max-w-[130px]">
                    {p.policyName}
                  </span>
                  <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                    {p.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none'
                    : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1.5 text-[10px] opacity-80 font-bold">
                  {msg.sender === 'user' ? (
                    <span>You</span>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center text-amber-400">
                        <Zap className="w-3 h-3 mr-1 fill-amber-400 inline" />
                        {activeSession.targetPlanName ? `${activeSession.targetPlanName} Advisor` : 'Insurance Advisor'}
                      </span>
                      {activeSession.targetOfferCode && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          #{activeSession.targetOfferCode}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' ? (
                  <div className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <ChatMessageRenderer content={msg.text} />
                )}

                {/* Recommended / Enrolled Plans from Database (Hidden in dedicated policy chat) */}
                {!activeSession.targetOfferCode && msg.recommendedOffers && msg.recommendedOffers.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {msg.recommendedOffers.every((o) =>
                          allUserPolicies.some(
                            (p) =>
                              p.status === 'ACTIVE' &&
                              p.policyName?.toLowerCase() === o.planName?.toLowerCase()
                          ) ||
                          (msg.savedPolicy?.status === 'ACTIVE' &&
                            msg.savedPolicy?.policyName?.toLowerCase() === o.planName?.toLowerCase())
                        )
                          ? 'Enrolled Policy Summary:'
                          : 'Recommended Plans for You:'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {msg.recommendedOffers.map((offer, oIdx) => {
                        const matchingActivePolicy =
                          allUserPolicies.find(
                            (p) =>
                              p.status === 'ACTIVE' &&
                              p.policyName?.toLowerCase() === offer.planName?.toLowerCase()
                          ) ||
                          (msg.savedPolicy?.status === 'ACTIVE' &&
                          msg.savedPolicy?.policyName?.toLowerCase() === offer.planName?.toLowerCase()
                            ? msg.savedPolicy
                            : null) ||
                          (activeSavedPolicy?.status === 'ACTIVE' &&
                          activeSavedPolicy?.policyName?.toLowerCase() === offer.planName?.toLowerCase()
                            ? activeSavedPolicy
                            : null);

                        const isPlanSelectedAndActive = Boolean(matchingActivePolicy);

                        return (
                          <div
                            key={offer._id || oIdx}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                              isPlanSelectedAndActive
                                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                                : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/40'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                    isPlanSelectedAndActive
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  {isPlanSelectedAndActive
                                    ? (matchingActivePolicy.whoIsInsured ? `${matchingActivePolicy.whoIsInsured} Covered` : 'Active Policy')
                                    : (oIdx === 0 ? 'Best Match' : `Option ${oIdx + 1}`)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {matchingActivePolicy?.policyNumber ? `#${matchingActivePolicy.policyNumber}` : offer.policyReferenceCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleFavorite(offer, e)}
                                    className={`p-1 rounded-lg transition-all cursor-pointer ${
                                      isPlanFavorite(user?._id, offer)
                                        ? 'text-rose-500 bg-rose-500/20'
                                        : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                                    }`}
                                    title={isPlanFavorite(user?._id, offer) ? "Remove from Favorites" : "Add to Favorites ❤️"}
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                                        isPlanFavorite(user?._id, offer) ? 'fill-rose-500 text-rose-500' : ''
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>

                              <h4
                                onClick={() => setSelectedOfferForModal(offer)}
                                className="text-xs font-bold text-white mt-1 hover:text-sky-300 cursor-pointer transition-colors flex items-center justify-between group/title"
                                title="Click to view full plan details"
                              >
                                <span>{offer.planName}</span>
                                <Info className="w-3 h-3 text-slate-500 group-hover/title:text-sky-400 transition-colors" />
                              </h4>
                              {matchingActivePolicy?.insuredName && (
                                <p className="text-[10px] text-emerald-400 font-semibold">
                                  Insured: {matchingActivePolicy.insuredName}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mb-2">
                                {offer.insurer} • {offer.coverageSubtype || offer.policyCategory}
                              </p>

                              <div className="space-y-1 text-[10px] text-slate-300 mb-3">
                                <div>
                                  <span className="text-slate-400">Limit:</span>{' '}
                                  <span className="font-bold text-white">
                                    {/^\d+$/.test(String(offer.annualCoverageAmount))
                                      ? `£${Number(offer.annualCoverageAmount).toLocaleString()}`
                                      : offer.annualCoverageAmount}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Premium:</span>{' '}
                                  <span className="font-bold text-amber-400">
                                    {offer.illustrativePremium || 'Standard'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Age Limit:</span>{' '}
                                  <span>
                                    {offer.minimumEntryAge || 18}–{offer.maximumEntryAge || 75} yrs
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Actions: More Details & Select Plan */}
                            <div className="flex items-center gap-2 pt-2.5 mt-auto border-t border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => setSelectedOfferForModal(offer)}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:border-sky-500/50 hover:text-white shadow-sm"
                                title="View full policy terms and details"
                              >
                                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span>More Details</span>
                              </button>

                              {isPlanSelectedAndActive ? (
                                <div className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/10">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Active</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendMessage(`Select ${offer.planName}`)
                                  }
                                  disabled={isThinking}
                                  className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                  Select Plan
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-slate-950/90 border border-slate-800 text-amber-300 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center space-x-2 animate-pulse">
                <Zap className="w-4 h-4 fill-amber-400 animate-bounce" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center space-x-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isThinking}
            placeholder="Type your message... (e.g., 'I need health cover for my family', 'What does my policy cover?')"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isThinking || !input.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </main>

      {/* Plan Full Details Modal */}
      {selectedOfferForModal && (
        <PlanDetailsModal
          offer={selectedOfferForModal}
          onClose={() => setSelectedOfferForModal(null)}
          onSelectPlan={(planName) => {
            setSelectedOfferForModal(null);
            handleSendMessage(`Select ${planName}`);
          }}
          isEnrolled={
            allUserPolicies.some(
              (p) =>
                p.status === 'ACTIVE' &&
                p.policyName?.toLowerCase() === selectedOfferForModal.planName?.toLowerCase()
            ) ||
            (activeSavedPolicy?.status === 'ACTIVE' &&
              activeSavedPolicy?.policyName?.toLowerCase() === selectedOfferForModal.planName?.toLowerCase())
          }
        />
      )}
    </div>
  );
}
