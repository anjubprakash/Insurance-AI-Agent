import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Mail,
  Phone,
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Shield,
  ChevronRight,
  Layers,
  Check,
  ArrowRight,
  Zap,
  Heart
} from 'lucide-react';
import {
  getMyPoliciesApi,
  updatePolicyApi,
  deletePolicyApi
} from '../api/policy.api.js';
import {
  getProfileApi,
  updateProfileApi
} from '../api/auth.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getFavorites, isPlanFavorite, togglePlanFavorite } from '../utils/favorites.js';

/**
 * ProfilePage Component
 * 
 * Manages the policyholder's core personal identity and subscribed insurance portfolio.
 * - Personal Profile: Full legal identity, contact coordinates, and KYC consent status.
 * - Side Navbar: Switching between personal profile and specific subscribed policies.
 * - "+ Start New": Directly navigates to the dedicated Insurances catalog page.
 * - Consent & KYC Modal: Conversational explanation and confirmation for secure personal data storage.
 */
export default function ProfilePage({ user: propUser, onNavigateToTab }) {
  const { user: authUser, updateUserSession } = useAuth();
  const effectiveUser = authUser || propUser;

  // Active navigation selection: 'personal', 'policies', or policy._id
  const [selectedNav, setSelectedNav] = useState(() => {
    try {
      return localStorage.getItem('profile_selected_nav') || 'personal';
    } catch {
      return 'personal';
    }
  });

  // User Profile state (Core identity & confidential details)
  const [userProfile, setUserProfile] = useState(effectiveUser || {});
  const [policies, setPolicies] = useState([]);
  const [favorites, setFavorites] = useState(() => getFavorites(effectiveUser?._id));
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  useEffect(() => {
    const onFavChange = () => {
      setFavorites(getFavorites(effectiveUser?._id));
    };
    window.addEventListener('insurance_favorites_changed', onFavChange);
    return () => window.removeEventListener('insurance_favorites_changed', onFavChange);
  }, [effectiveUser?._id]);

  // Toast notification
  const [toast, setToast] = useState(null);

  // Consent & KYC Modal state
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycForm, setKycForm] = useState({
    consentDataStore: effectiveUser?.consentDataStore !== false,
    idProofType: effectiveUser?.idProofType || 'PENDING_AT_PURCHASE',
    idProofNumber: effectiveUser?.idProofNumber || ''
  });
  const [isSavingKyc, setIsSavingKyc] = useState(false);

  // Personal Profile Form state
  const [personalForm, setPersonalForm] = useState({
    name: effectiveUser?.name || '',
    email: effectiveUser?.email || '',
    phone: effectiveUser?.phone || '',
    dateOfBirth: effectiveUser?.dateOfBirth || '',
    age: effectiveUser?.age || '',
    gender: effectiveUser?.gender || 'PREFER_NOT_TO_SAY',
    city: effectiveUser?.city || '',
    pincode: effectiveUser?.pincode || '',
    preferredLanguage: effectiveUser?.preferredLanguage || 'English'
  });

  // Selected Policy Form state (for inspecting and editing an enrolled policy)
  const [activePolicyForm, setActivePolicyForm] = useState(null);
  const [initialPolicyData, setInitialPolicyData] = useState(null);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false);

  const hasPolicyChanges = Boolean(
    activePolicyForm &&
    initialPolicyData &&
    JSON.stringify(activePolicyForm) !== initialPolicyData
  );

  // On mount: Fetch user profile & user policies
  useEffect(() => {
    loadProfileAndPolicies();
  }, []);

  /**
   * Helper to display notifications
   */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /**
   * Fetches latest user identity and policies from separate endpoints
   */
  const loadProfileAndPolicies = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user identity
      const userRes = await getProfileApi();
      const freshUser = userRes.data;
      if (freshUser) {
        setUserProfile(freshUser);
        updateUserSession(freshUser);
        setPersonalForm({
          name: freshUser.name || '',
          email: freshUser.email || '',
          phone: freshUser.phone || '',
          dateOfBirth: freshUser.dateOfBirth || '',
          age: freshUser.age || '',
          gender: freshUser.gender || 'PREFER_NOT_TO_SAY',
          city: freshUser.city || '',
          pincode: freshUser.pincode || '',
          preferredLanguage: freshUser.preferredLanguage || 'English'
        });
        setKycForm({
          consentDataStore: freshUser.consentDataStore !== false,
          idProofType: freshUser.idProofType || 'PENDING_AT_PURCHASE',
          idProofNumber: freshUser.idProofNumber || ''
        });
      }

      // 2. Fetch policies for this user from /api/policies
      const policiesRes = await getMyPoliciesApi();
      const userPols = policiesRes.data || [];
      setPolicies(userPols);

      // If a policy was selected in localStorage, keep it synced
      const currentNav = localStorage.getItem('profile_selected_nav') || 'personal';
      if (
        currentNav !== 'personal' &&
        currentNav !== 'policies' &&
        currentNav !== 'favorites' &&
        userPols.length > 0
      ) {
        const matching = userPols.find((p) => p._id === currentNav);
        if (matching) {
          const formatted = {
            ...matching,
            insuredName: matching.insuredName || matching.nomineeName || '',
            healthOrRiskConditions: matching.healthOrRiskConditions || ''
          };
          setActivePolicyForm(formatted);
          setInitialPolicyData(JSON.stringify(formatted));
        } else {
          setSelectedNav('policies');
          localStorage.setItem('profile_selected_nav', 'policies');
        }
      }
    } catch (err) {
      console.warn('Profile load notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles switching selected item in Side Navbar
   */
  const handleSelectNav = (navKey, policyData = null) => {
    setSelectedNav(navKey);
    try {
      localStorage.setItem('profile_selected_nav', navKey);
    } catch {}
    if (policyData) {
      const formatted = {
        ...policyData,
        insuredName: policyData.insuredName || policyData.nomineeName || '',
        healthOrRiskConditions: policyData.healthOrRiskConditions || ''
      };
      setActivePolicyForm(formatted);
      setInitialPolicyData(JSON.stringify(formatted));
    } else {
      setActivePolicyForm(null);
      setInitialPolicyData(null);
    }
  };

  /**
   * Navigates to the Insurances page catalog
   */
  const handleGoToInsurances = () => {
    if (onNavigateToTab) {
      onNavigateToTab('insurance');
    }
  };

  /**
   * Saves user personal profile updates
   */
  const handleSavePersonalProfile = async (e) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      const res = await updateProfileApi(personalForm);
      const updated = res.data;
      setUserProfile(updated);
      updateUserSession(updated);
      showToast('Personal profile information saved successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update personal profile', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  /**
   * Saves Consent & KYC settings with friendly confirmation prompt
   */
  const handleSaveKycModal = async () => {
    if (
      !window.confirm(
        'Are you okay with us securely storing and using your personal details to customize and manage your insurance policies?'
      )
    ) {
      return;
    }
    setIsSavingKyc(true);
    try {
      const res = await updateProfileApi(kycForm);
      const updated = res.data;
      setUserProfile(updated);
      updateUserSession(updated);
      setShowKycModal(false);
      showToast('Consent & KYC settings updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update KYC settings', 'error');
    } finally {
      setIsSavingKyc(false);
    }
  };

  /**
   * Updates an existing policy selected from the side navbar
   */
  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    if (!activePolicyForm || !activePolicyForm._id) return;
    setIsSavingPolicy(true);
    try {
      const res = await updatePolicyApi(activePolicyForm._id, activePolicyForm);
      const updatedPolicy = res.data;

      setPolicies((prev) =>
        prev.map((p) => (p._id === updatedPolicy._id ? updatedPolicy : p))
      );
      setActivePolicyForm({ ...updatedPolicy });
      setInitialPolicyData(JSON.stringify(updatedPolicy));
      showToast(`Policy #${updatedPolicy.policyNumber} updated successfully!`, 'success');
      loadProfileAndPolicies();
    } catch (err) {
      showToast(err.message || 'Failed to update policy', 'error');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  /**
   * Deletes a policy selected from the side navbar
   */
  const handleDeletePolicy = async (policyId) => {
    if (!window.confirm('Are you sure you want to remove this policy from your records?')) {
      return;
    }
    setIsDeletingPolicy(true);
    try {
      await deletePolicyApi(policyId);
      const filtered = policies.filter((p) => p._id !== policyId);
      setPolicies(filtered);
      setSelectedNav('policies');
      setActivePolicyForm(null);
      showToast('Policy deleted successfully', 'success');
      loadProfileAndPolicies();
    } catch (err) {
      showToast(err.message || 'Failed to delete policy', 'error');
    } finally {
      setIsDeletingPolicy(false);
    }
  };

  /**
   * Confirms and activates a pending policy
   */
  const handleConfirmAndActivatePolicy = async (policyToActivate = null) => {
    const target = policyToActivate || activePolicyForm;
    if (!target || !target._id) return;
    setIsSavingPolicy(true);
    try {
      const payload = { ...target, status: 'ACTIVE' };
      const res = await updatePolicyApi(target._id, payload);
      const updatedPolicy = res.data;

      setPolicies((prev) =>
        prev.map((p) => (p._id === updatedPolicy._id ? updatedPolicy : p))
      );
      if (activePolicyForm && activePolicyForm._id === target._id) {
        setActivePolicyForm({ ...updatedPolicy });
        setInitialPolicyData(JSON.stringify(updatedPolicy));
      }
      showToast(`Policy #${updatedPolicy.policyNumber} confirmed and activated!`, 'success');
      loadProfileAndPolicies();
    } catch (err) {
      showToast(err.message || 'Failed to activate policy', 'error');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  /**
   * Computes policy intake completion score (0-100%) and readiness status
   */
  const getPolicyIntakeStatus = (policy) => {
    if (!policy) return { percent: 0, isReady: false, label: 'Pending', missing: [] };
    if (policy.status === 'ACTIVE') {
      return { percent: 100, isReady: true, label: 'ACTIVE', missing: [] };
    }

    const type = (policy.insuranceType || 'HEALTH').toUpperCase();
    const missing = [];

    if (!policy.whoIsInsured || policy.whoIsInsured.trim() === '') {
      missing.push('Who is Covered');
    }
    if (!policy.insuredName || policy.insuredName.trim() === '' || policy.insuredName.trim().toLowerCase() === 'pending') {
      missing.push('Insured Name');
    }
    if (
      !policy.healthOrRiskConditions ||
      policy.healthOrRiskConditions.trim() === '' ||
      policy.healthOrRiskConditions.trim().toLowerCase() === 'pending'
    ) {
      missing.push(
        type === 'AUTO'
          ? 'Vehicle Details / Reg'
          : type === 'HOME'
          ? 'Property Details'
          : type === 'COMMERCIAL'
          ? 'Business Asset Details'
          : 'Health / Risk Details'
      );
    }

    if (type === 'COMMERCIAL' || type === 'HOME') {
      if (!policy.sumInsured || policy.sumInsured.trim() === '') {
        missing.push('Coverage Limit');
      }
    } else {
      if (policy.coveredAge === null || policy.coveredAge === undefined || policy.coveredAge === '' || Number(policy.coveredAge) <= 0) {
        missing.push(type === 'AUTO' ? 'Driver Age' : 'Covered Age');
      }
    }

    const totalFields = 4;
    const filledCount = Math.max(0, totalFields - missing.length);
    const percent = Math.min(100, Math.round((filledCount / totalFields) * 100));
    const isReady = missing.length === 0;

    return {
      percent,
      isReady,
      missing,
      label: isReady ? 'READY TO CONFIRM' : `${percent}% COLLECTED`
    };
  };

  /**
   * Returns category-tailored column labels and values for the policy card
   * (Ensures CAR/AUTO never displays medical/health details!)
   */
  const getCategoryDisplayFields = (policy) => {
    const type = (policy.insuranceType || 'HEALTH').toUpperCase();
    const isSelf = policy.whoIsInsured === 'SELF';
    const fallbackName = isSelf ? userProfile?.name || 'Self' : 'Pending';
    const insuredName = policy.insuredName || fallbackName;

    switch (type) {
      case 'AUTO':
        return {
          col1Label: 'Driver / Entity',
          col1Val: policy.whoIsInsured || 'Driver',
          col2Label: 'Insured Name',
          col2Val: insuredName,
          col3Label: 'Driver Age',
          col3Val: policy.coveredAge ? `${policy.coveredAge} yrs` : 'Pending',
          col4Label: 'Vehicle Details / Reg',
          col4Val: policy.healthOrRiskConditions || 'Pending'
        };
      case 'HOME':
        return {
          col1Label: 'Property Type',
          col1Val: policy.whoIsInsured || 'Residential',
          col2Label: 'Occupant / Owner',
          col2Val: insuredName,
          col3Label: 'Rebuild / Coverage',
          col3Val: policy.sumInsured || 'Standard',
          col4Label: 'Property Details & Security',
          col4Val: policy.healthOrRiskConditions || 'Pending'
        };
      case 'COMMERCIAL':
        return {
          col1Label: 'Entity Type',
          col1Val: 'Business',
          col2Label: 'Company Name',
          col2Val: insuredName,
          col3Label: 'Coverage Limit',
          col3Val: policy.sumInsured || 'Standard',
          col4Label: 'Trade & Business Activities',
          col4Val: policy.healthOrRiskConditions || 'Pending'
        };
      case 'LIFE':
        return {
          col1Label: 'Insured Person',
          col1Val: policy.whoIsInsured || 'Life Insured',
          col2Label: 'Full Name',
          col2Val: insuredName,
          col3Label: 'Entry Age',
          col3Val: policy.coveredAge ? `${policy.coveredAge} yrs` : 'Pending',
          col4Label: 'Nominee / Beneficiary',
          col4Val: policy.nomineeName || policy.healthOrRiskConditions || 'Pending'
        };
      case 'TRAVEL':
        return {
          col1Label: 'Traveller',
          col1Val: policy.whoIsInsured || 'Traveller',
          col2Label: 'Full Name',
          col2Val: insuredName,
          col3Label: 'Traveller Age',
          col3Val: policy.coveredAge ? `${policy.coveredAge} yrs` : 'Pending',
          col4Label: 'Trip & Destination',
          col4Val: policy.healthOrRiskConditions || 'Pending'
        };
      case 'HEALTH':
      default:
        return {
          col1Label: 'Who Is Insured',
          col1Val: policy.whoIsInsured || 'Self',
          col2Label: 'Insured Name',
          col2Val: insuredName,
          col3Label: 'Covered Age',
          col3Val: policy.coveredAge ? `${policy.coveredAge} yrs` : 'Pending',
          col4Label: 'Conditions / Medical',
          col4Val: policy.healthOrRiskConditions || 'Pending'
        };
    }
  };

  /**
   * Returns category-tailored labels & placeholders for the Policy Form inputs
   */
  const getCategoryFormConfig = (insuranceType) => {
    const type = (insuranceType || 'HEALTH').toUpperCase();
    switch (type) {
      case 'AUTO':
        return {
          ageLabel: '4. Primary Driver Age',
          agePlaceholder: 'e.g. 35',
          detailLabel: '5. Vehicle Make, Model, Year & Registration',
          detailPlaceholder: 'e.g. 2022 Ford Focus, Reg: AB22 CDE, Clean record'
        };
      case 'HOME':
        return {
          ageLabel: '4. Year Built / Property Age',
          agePlaceholder: 'e.g. 1995',
          detailLabel: '5. Property Type, Address & Security Features',
          detailPlaceholder: 'e.g. 3-Bed Detached, Manchester, Approved deadbolt locks'
        };
      case 'COMMERCIAL':
        return {
          ageLabel: '4. Years Trading / Established',
          agePlaceholder: 'e.g. 5',
          detailLabel: '5. Business Trade, Staff Count & Turnover',
          detailPlaceholder: 'e.g. Retail electronics store, 5 staff, £200k turnover'
        };
      case 'LIFE':
        return {
          ageLabel: '4. Insured Person Age',
          agePlaceholder: 'e.g. 42',
          detailLabel: '5. Smoking Status & Medical History',
          detailPlaceholder: 'e.g. Non-smoker, clean health history'
        };
      case 'TRAVEL':
        return {
          ageLabel: '4. Traveller Age',
          agePlaceholder: 'e.g. 28',
          detailLabel: '5. Destination Country & Trip Duration',
          detailPlaceholder: 'e.g. Spain, 14 days, Single Trip'
        };
      case 'HEALTH':
      default:
        return {
          ageLabel: '4. Covered Person Age',
          agePlaceholder: 'e.g. 64',
          detailLabel: '5. Health Conditions / Medical History',
          detailPlaceholder: 'e.g. Type 2 diabetes, Hypertension, or None'
        };
    }
  };

  /**
   * Helper to format currency numbers
   */
  const formatCurrency = (amt) => {
    if (!amt) return 'Standard Coverage';
    if (typeof amt === 'number') {
      return amt >= 1000 ? `£${amt.toLocaleString()}` : `£${amt}`;
    }
    return String(amt).startsWith('£') || String(amt).startsWith('$') || String(amt).startsWith('₹')
      ? amt
      : `£${amt}`;
  };

  /**
   * Removes a saved plan from user's favorites
   */
  const handleRemoveFavorite = (offer) => {
    const res = togglePlanFavorite(effectiveUser?._id, offer);
    setFavorites(res.list);
    showToast(`Removed "${offer.planName}" from Favorites`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
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

      {/* Profile Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          {/* User Identity Details */}
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg border border-white/10 shrink-0">
              {userProfile.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {userProfile.name || 'Account Profile'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {userProfile.role || 'POLICYHOLDER'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                <span className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {userProfile.email}
                </span>
                {userProfile.phone && (
                  <span className="flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {userProfile.phone}
                  </span>
                )}
                {userProfile.customerId && (
                  <span className="flex items-center font-mono text-sky-400">
                    <Key className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {userProfile.customerId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Right Consent & KYC Badge/Button */}
          <div className="flex items-center space-x-3 self-end sm:self-center">
            <button
              onClick={() => setShowKycModal(true)}
              className="px-3.5 py-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 flex items-center space-x-2 text-xs font-semibold shadow-sm transition-all group"
              title="View and update Consent & KYC status"
            >
              <Shield className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Consent & KYC</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  userProfile.idProofType && userProfile.idProofType !== 'PENDING_AT_PURCHASE'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Side Navbar on Left, Active View on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* =========================================================================
            SIDE NAVBAR: Personal Details + Policies Button + Subscribed Policies List
           ========================================================================= */}
        <aside className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-5 h-fit shadow-xl">
          <div className="space-y-3">
            {/* Nav Header */}
            <div className="px-2 pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Profile Navigation
              </span>
            </div>

            {/* Item 1: Personal Details */}
            <button
              onClick={() => handleSelectNav('personal')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                selectedNav === 'personal'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-lg shadow-sky-500/20'
                  : 'bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate">Personal Details</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
            </button>

            {/* Item 2: Policies Button (Directly after Personal Details) */}
            <button
              onClick={() => handleSelectNav('policies')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                selectedNav === 'policies' || (selectedNav !== 'personal' && selectedNav !== 'favorites' && activePolicyForm)
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Layers className="w-4 h-4 shrink-0" />
                <span className="truncate">Policies ({policies.length})</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
            </button>

            {/* Item 3: Favorites Button */}
            <button
              onClick={() => handleSelectNav('favorites')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                selectedNav === 'favorites'
                  ? 'bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/25'
                  : 'bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Heart
                  className={`w-4 h-4 shrink-0 ${
                    selectedNav === 'favorites' ? 'fill-white text-white' : 'text-rose-400'
                  }`}
                />
                <span className="truncate">Favorites ({favorites.length})</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
            </button>
          </div>
        </aside>

        {/* =========================================================================
            MAIN CONTENT AREA
           ========================================================================= */}
        <main className="lg:col-span-3 space-y-6">
          {/* -----------------------------------------------------------------------
              VIEW 1: PERSONAL PROFILE (Core Identity & Coordinates)
             ----------------------------------------------------------------------- */}
          {selectedNav === 'personal' && (
            <form onSubmit={handleSavePersonalProfile} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Personal Identity & Contact Information
                    </h2>
                    <p className="text-xs text-slate-400">
                      Primary personal profile details and contact coordinates.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  {isSavingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={personalForm.name}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Full legal name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={personalForm.email}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={personalForm.dateOfBirth}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Age</label>
                  <input
                    type="number"
                    value={personalForm.age}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, age: e.target.value }))}
                    placeholder="e.g. 34"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Gender</label>
                  <select
                    value={personalForm.gender}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500 transition-all"
                  >
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="NON_BINARY">Non-Binary</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">City</label>
                  <input
                    type="text"
                    value={personalForm.city}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="e.g. Chicago"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Pincode / Postal Code</label>
                  <input
                    type="text"
                    value={personalForm.pincode}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, pincode: e.target.value }))}
                    placeholder="e.g. 60601"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">Preferred Language</label>
                  <select
                    value={personalForm.preferredLanguage}
                    onChange={(e) => setPersonalForm((p) => ({ ...p, preferredLanguage: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500 transition-all"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Hindi">Hindi</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Mandarin">Mandarin</option>
                  </select>
                </div>
              </div>

            </form>
          )}

          {/* -----------------------------------------------------------------------
              VIEW 2: POLICIES OVERVIEW (When "Policies" button is clicked)
             ----------------------------------------------------------------------- */}
          {selectedNav === 'policies' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      My Insurance Policies ({policies.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                      Click any policy below to view or edit the policy details collected from your conversation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToTab && onNavigateToTab('chat', { forceNewChat: true })}
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>Chat with AI Advisor</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToInsurances}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Start New</span>
                  </button>
                </div>
              </div>

              {policies.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 space-y-3">
                  <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    You do not have any policies yet. Chat with the AI Advisor to set up a policy or browse available plans.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {policies.map((p) => {
                    const fields = getCategoryDisplayFields(p);
                    const intake = getPolicyIntakeStatus(p);

                    return (
                      <div
                        key={p._id}
                        onClick={() => handleSelectNav(p._id, p)}
                        className="p-5 bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/40 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 group shadow-lg"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Category: {p.insuranceType || 'HEALTH'}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                p.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {p.status === 'PENDING' ? 'COLLECTING DETAILS' : p.status || 'ACTIVE'}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                              {p.policyName}
                            </h3>
                            <p className="font-mono text-[11px] text-emerald-400 mt-0.5">
                              #{p.policyNumber}
                            </p>
                          </div>

                          {/* Category-Specific Intake Columns */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                            <div>
                              <span className="text-slate-500 block text-[10px]">{fields.col1Label}</span>
                              <span className="font-semibold text-white truncate block">{fields.col1Val || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">{fields.col2Label}</span>
                              <span className="font-semibold text-white truncate block">{fields.col2Val || 'Pending'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">{fields.col3Label}</span>
                              <span className="font-semibold text-white truncate block">{fields.col3Val || 'Pending'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">{fields.col4Label}</span>
                              <span className="font-semibold text-white truncate block">{fields.col4Val || 'Pending'}</span>
                            </div>
                          </div>

                          {/* Small Status & Intake Progress Bar */}
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 font-medium">Policy Intake Progress</span>
                              <span className={`font-bold font-mono ${p.status === 'ACTIVE' || intake.isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {p.status === 'ACTIVE' ? '100% Active' : intake.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  p.status === 'ACTIVE'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : intake.isReady
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                    : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                }`}
                                style={{ width: `${p.status === 'ACTIVE' ? 100 : Math.max(intake.percent, 25)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Footer Actions: Open Form + Quick Confirm */}
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs font-bold text-emerald-400">
                          <div className="flex items-center space-x-1 group-hover:text-emerald-300">
                            <span>Open Policy Details Form</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>

                          {p.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!intake.isReady) {
                                  handleSelectNav(p._id, p);
                                  return;
                                }
                                handleConfirmAndActivatePolicy(p);
                              }}
                              disabled={!intake.isReady || isSavingPolicy}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-all shrink-0 ${
                                intake.isReady
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 cursor-pointer shadow-sm'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                              }`}
                              title={
                                intake.isReady
                                  ? 'Confirm and activate this policy immediately'
                                  : `Missing details (${intake.missing.join(', ')}). Click to fill.`
                              }
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 ${intake.isReady ? 'text-emerald-400' : 'text-slate-500'}`} />
                              <span>{intake.isReady ? 'Confirm & Activate' : 'Pending Details'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------------
              VIEW 3: FAVORITE PLANS (When "Favorites" button is clicked)
             ----------------------------------------------------------------------- */}
          {selectedNav === 'favorites' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                    <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Favorite Insurance Plans ({favorites.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                      Saved insurance plans you bookmarked. Review coverage details, chat with the AI Advisor, or enroll anytime.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToTab && onNavigateToTab('chat', { forceNewChat: true })}
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>Ask AI Advisor</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToInsurances}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Browse Plans</span>
                  </button>
                </div>
              </div>

              {favorites.length === 0 ? (
                <div className="p-10 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-rose-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">No Favorite Plans Saved Yet</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Click the small love / heart (<span className="text-rose-400 font-semibold">❤️</span>) button on any insurance card or AI recommendation to save it here for later review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoToInsurances}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                  >
                    <span>Explore Available Insurance Plans</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {favorites.map((fav) => (
                    <div
                      key={fav._id || fav.policyReferenceCode || fav.planName}
                      className="p-5 bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-rose-500/40 rounded-2xl transition-all flex flex-col justify-between space-y-4 group shadow-lg"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              {fav.policyCategory || 'INSURANCE'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {fav.insurer || 'Carrier'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFavorite(fav)}
                            className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition-all cursor-pointer shrink-0 shadow-sm"
                            title="Remove from Favorites"
                          >
                            <Heart className="w-4 h-4 fill-rose-500 text-rose-500 hover:scale-110 transition-transform" />
                          </button>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                            {fav.planName}
                          </h3>
                          {fav.policyReferenceCode && (
                            <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                              #{fav.policyReferenceCode}
                            </p>
                          )}
                        </div>

                        {/* Coverage Details */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 border border-slate-800/70 rounded-xl p-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Coverage Limit</span>
                            <span className="text-sm font-extrabold text-emerald-400 font-mono">
                              {formatCurrency(fav.annualCoverageAmount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Monthly Premium</span>
                            <span className="text-sm font-bold text-white">
                              {fav.illustrativePremium || 'Standard Rate'}
                            </span>
                          </div>
                        </div>

                        {/* Extra features / sublimits */}
                        {(fav.coverageSubtype || fav.excessDeductible || fav.benefitSublimits) && (
                          <div className="space-y-1.5 pt-1 text-[11px] text-slate-300">
                            {fav.coverageSubtype && (
                              <div className="flex items-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span><strong className="text-slate-400">Type:</strong> {fav.coverageSubtype}</span>
                              </div>
                            )}
                            {fav.excessDeductible && (
                              <div className="flex items-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span><strong className="text-slate-400">Deductible:</strong> {fav.excessDeductible}</span>
                              </div>
                            )}
                            {fav.benefitSublimits && (
                              <div className="flex items-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate"><strong className="text-slate-400">Benefits:</strong> {fav.benefitSublimits}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigateToTab && onNavigateToTab('chat', { targetOffer: fav, forceNewChat: true })}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>Talk to Advisor ⚡</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleGoToInsurances}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                        >
                          <span>View in Catalog</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------------
              VIEW 4: SPECIFIC POLICY DETAILS FORM (When a policy is selected)
             ----------------------------------------------------------------------- */}
          {selectedNav !== 'personal' &&
            selectedNav !== 'policies' &&
            selectedNav !== 'favorites' &&
            activePolicyForm && (
            <form onSubmit={handleUpdatePolicy} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        {activePolicyForm.policyName}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                        {activePolicyForm.insuranceType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          activePolicyForm.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {activePolicyForm.status || 'ACTIVE'}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-emerald-400 font-semibold mt-0.5">
                      Policy #{activePolicyForm.policyNumber}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToTab &&
                      onNavigateToTab('chat', {
                        targetOffer: {
                          planName: activePolicyForm.policyName,
                          policyReferenceCode: activePolicyForm.policyNumber,
                          policyCategory: activePolicyForm.insuranceType
                        },
                        targetPolicyNumber: activePolicyForm.policyNumber
                      })
                    }
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                    title="Continue chatting with AI Advisor about this policy"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>Ask AI Advisor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePolicy(activePolicyForm._id)}
                    disabled={isDeletingPolicy}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    title="Delete Policy"
                    aria-label="Delete Policy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingPolicy || !hasPolicyChanges}
                    className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all ${
                      hasPolicyChanges && !isSavingPolicy
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                    }`}
                    title={hasPolicyChanges ? 'Save modified changes' : 'No changes to save'}
                  >
                    {isSavingPolicy ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Form Status Bar */}
              {(() => {
                const intake = getPolicyIntakeStatus(activePolicyForm);
                return (
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-semibold">Intake Completion:</span>
                        <span className={`font-mono font-bold ${activePolicyForm.status === 'ACTIVE' || intake.isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {activePolicyForm.status === 'ACTIVE' ? '100% Active' : `${intake.percent}% (${intake.label})`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {activePolicyForm.status === 'ACTIVE'
                          ? 'This policy is fully active and confirmed.'
                          : intake.isReady
                          ? 'All required details are in place. Ready to activate!'
                          : 'Chat with AI Advisor or fill in details below to complete.'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          activePolicyForm.status === 'ACTIVE'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : intake.isReady
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        style={{ width: `${activePolicyForm.status === 'ACTIVE' ? 100 : Math.max(intake.percent, 25)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Policy Intake & Coverage Details Form Grid */}
              {(() => {
                const categoryConfig = getCategoryFormConfig(activePolicyForm.insuranceType);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        1. Insurance Category *
                      </label>
                      <select
                        value={activePolicyForm.insuranceType || 'HEALTH'}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, insuranceType: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-all"
                      >
                        <option value="AUTO">Car & Motor</option>
                        <option value="HEALTH">Health & Medical</option>
                        <option value="HOME">Home & Property</option>
                        <option value="LIFE">Term Life</option>
                        <option value="COMMERCIAL">Commercial & Business</option>
                        <option value="ACCIDENT">Personal Accident</option>
                        <option value="AGRICULTURE">Agriculture Cover</option>
                        <option value="TRAVEL">Travel Insurance</option>
                        <option value="LIABILITY">Liability (D&O / E&O)</option>
                        <option value="GENERAL">General Insurance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        2. Who Is Taking / Covered *
                      </label>
                      <select
                        value={activePolicyForm.whoIsInsured || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, whoIsInsured: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-all"
                      >
                        <option value="">— Select / Unspecified —</option>
                        <option value="SELF">Self</option>
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="PARENTS">Parents</option>
                        <option value="SPOUSE">Spouse</option>
                        <option value="CHILD">Child</option>
                        <option value="SON">Son</option>
                        <option value="DAUGHTER">Daughter</option>
                        <option value="FAMILY">Family (Floater)</option>
                        <option value="BUSINESS">Business</option>
                        <option value="ASSET">Asset / Vehicle / Property</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        3. Insured Person Full Name
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.insuredName || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, insuredName: e.target.value }))}
                        placeholder="e.g. Ramesh Nair"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        {categoryConfig.ageLabel}
                      </label>
                      <input
                        type="number"
                        value={activePolicyForm.coveredAge ?? ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, coveredAge: e.target.value }))}
                        placeholder={categoryConfig.agePlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        {categoryConfig.detailLabel}
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.healthOrRiskConditions || ''}
                        onChange={(e) =>
                          setActivePolicyForm((p) => ({ ...p, healthOrRiskConditions: e.target.value }))
                        }
                        placeholder={categoryConfig.detailPlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Policy / Plan Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={activePolicyForm.policyName || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, policyName: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Sum Insured / Coverage Limit
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.sumInsured || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, sumInsured: e.target.value }))}
                        placeholder="e.g. £150,000"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Monthly Premium
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.premium || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, premium: e.target.value }))}
                        placeholder="e.g. £132/month"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Policy Term / Duration
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.policyTerm || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, policyTerm: e.target.value }))}
                        placeholder="e.g. 1 Year"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Nominee Full Name
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.nomineeName || ''}
                        onChange={(e) => setActivePolicyForm((p) => ({ ...p, nomineeName: e.target.value }))}
                        placeholder="Nominee Full Name"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Nominee Relationship
                      </label>
                      <input
                        type="text"
                        value={activePolicyForm.nomineeRelationship || ''}
                        onChange={(e) =>
                          setActivePolicyForm((p) => ({ ...p, nomineeRelationship: e.target.value }))
                        }
                        placeholder="e.g. Spouse, Child, Father"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Form Footer Action Bar (Bottom Right Confirm Button Only) */}
              {(() => {
                const intake = getPolicyIntakeStatus(activePolicyForm);
                return (
                  <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-400 flex items-center space-x-2">
                      {activePolicyForm.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>This policy is fully active and confirmed.</span>
                        </span>
                      ) : intake.isReady ? (
                        <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>All required intake details are complete! Ready to activate.</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 text-amber-400/90 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            Missing details: <strong className="text-amber-300">{intake.missing.join(', ')}</strong>. Complete them to enable activation.
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                      {activePolicyForm.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmAndActivatePolicy(activePolicyForm)}
                          disabled={!intake.isReady || isSavingPolicy}
                          className={`px-5 py-2.5 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all ${
                            intake.isReady && !isSavingPolicy
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 cursor-pointer'
                              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                          }`}
                          title={
                            intake.isReady
                              ? 'Confirm all details and activate this policy'
                              : `Please complete missing details (${intake.missing.join(', ')}) to activate`
                          }
                        >
                          <CheckCircle2
                            className={`w-4 h-4 ${
                              intake.isReady ? 'text-slate-950 fill-emerald-300' : 'text-slate-500'
                            }`}
                          />
                          <span>Confirm & Activate Policy</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </form>
          )}
        </main>
      </div>

      {/* =========================================================================
          CONSENT & KYC SETUP MODAL
         ========================================================================= */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center space-x-2.5">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Personal Data Consent & KYC Setup
                </h3>
              </div>
              <button
                onClick={() => setShowKycModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="space-y-4">
                {/* FRIENDLY CONVERSATIONAL CONSENT EXPLANATION */}
                <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-200 leading-relaxed space-y-1.5">
                      <p className="font-bold text-white text-xs">
                        We are collecting your personal details
                      </p>
                      <p className="text-slate-300 text-[11px] leading-normal">
                        We take your personal details (such as your full legal name, phone number, date of birth,
                        age, city of residence, and official ID documents) so we can accurately customize,
                        underwrite, and manage your insurance policies.
                      </p>
                      <p className="text-indigo-300 font-semibold text-xs pt-1">
                        Are you okay with us taking and securely storing these details?
                      </p>
                    </div>
                  </div>

                  <label className="flex items-start space-x-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl cursor-pointer hover:bg-indigo-500/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={kycForm.consentDataStore}
                      onChange={(e) => setKycForm((k) => ({ ...k, consentDataStore: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 accent-indigo-500 rounded"
                    />
                    <div className="text-xs text-white font-semibold">
                      Yes, I am okay with sharing and securely storing my personal details for my insurance policies.
                    </div>
                  </label>

                  <p className="text-[10px] text-slate-500 italic px-1">
                    * Your details are 100% confidential, protected with enterprise-grade encryption, and never shared with unauthorized third parties.
                  </p>
                </div>

                {/* ID Proof Inputs */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">
                    ID Proof Document Type
                  </label>
                  <select
                    value={kycForm.idProofType}
                    onChange={(e) => setKycForm((k) => ({ ...k, idProofType: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="PENDING_AT_PURCHASE">Collected Later (At Purchase / Underwriting)</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driver's License</option>
                    <option value="NATIONAL_ID">National ID Card</option>
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="TAX_ID">Tax ID / PAN Card</option>
                    <option value="OTHER">Other Authorized Photo ID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">
                    ID Proof Document Number
                  </label>
                  <input
                    type="text"
                    value={kycForm.idProofNumber}
                    onChange={(e) => setKycForm((k) => ({ ...k, idProofNumber: e.target.value }))}
                    placeholder="e.g. DL-98234-X or Passport Number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Action buttons with confirmation */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowKycModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveKycModal}
                  disabled={isSavingKyc}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isSavingKyc ? 'Saving...' : 'Confirm & Save KYC'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
