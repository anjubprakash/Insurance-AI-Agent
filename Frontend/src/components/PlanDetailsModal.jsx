import React from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Building,
  Calendar,
  AlertCircle,
  Clock,
  FileText,
  DollarSign,
  Activity,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function PlanDetailsModal({
  offer,
  onClose,
  onSelectPlan,
  isEnrolled = false
}) {
  if (!offer) return null;

  const formatAmount = (val) => {
    if (!val) return '—';
    if (/^\d+$/.test(String(val))) {
      return `£${Number(val).toLocaleString()}`;
    }
    return String(val);
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'HEALTH':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'AUTO':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'HOME':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'LIFE':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/80">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {offer.planName}
                </h2>
                <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {offer.policyReferenceCode}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(
                    offer.policyCategory
                  )}`}
                >
                  {offer.policyCategory || 'INSURANCE'}
                </span>
                {isEnrolled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Enrolled & Active</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium text-slate-300">{offer.insurer || 'General Underwriting Mutual'}</span>
                {offer.coverageSubtype && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{offer.coverageSubtype}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
          {/* Key Financials & Coverage Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Coverage Limit
              </span>
              <div className="text-sm sm:text-base font-extrabold text-white mt-1">
                {formatAmount(offer.annualCoverageAmount)}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">Annual max per person</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Monthly Premium
              </span>
              <div className="text-sm sm:text-base font-extrabold text-amber-400 mt-1">
                {offer.illustrativePremium || 'Standard'}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 truncate" title={offer.premiumBasis}>
                {offer.premiumBasis || 'Illustrative basis'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Excess / Deductible
              </span>
              <div className="text-sm sm:text-base font-extrabold text-sky-400 mt-1">
                {offer.excessDeductible || 'None / Zero'}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">Payable per claim</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Eligible Age Range
              </span>
              <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-1">
                {offer.minimumEntryAge || 18}–{offer.maximumEntryAge || 75} yrs
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">Entry criteria</span>
            </div>
          </div>

          {/* Detailed Policy Provisions */}
          <div className="space-y-4">
            {/* 1. Benefit Sub-Limits */}
            {offer.benefitSublimits && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Stethoscope className="w-4 h-4" />
                  <span>Benefit Sub-Limits & Special Allowances</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.benefitSublimits}
                </p>
              </div>
            )}

            {/* 2. Pre-Existing Conditions & Medical Underwriting */}
            {offer.preExistingConditionRules && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Activity className="w-4 h-4" />
                  <span>Pre-Existing Conditions & Medical Evaluation</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.preExistingConditionRules}
                </p>
              </div>
            )}

            {/* 3. Underwriting Risks Considered */}
            {offer.risksConsidered && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4" />
                  <span>Underwriting Criteria & Risks Evaluated</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.risksConsidered}
                </p>
              </div>
            )}

            {/* 4. Waiting Periods */}
            {offer.waitingPeriods && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  <span>Waiting Periods & Effective Dates</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.waitingPeriods}
                </p>
              </div>
            )}

            {/* 5. Exclusions & Limitations */}
            {offer.exclusions && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-rose-900/30 bg-rose-950/10 space-y-1.5">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>Exclusions & Coverage Restrictions</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.exclusions}
                </p>
              </div>
            )}

            {/* 6. Claims & FNOL Process */}
            {offer.claimsProcess && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Claims Notification & FNOL Process</span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">
                  {offer.claimsProcess}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center space-x-3">
            {isEnrolled ? (
              <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-500/10">
                <ShieldCheck className="w-4 h-4" />
                <span>Currently Enrolled & Active</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectPlan && onSelectPlan(offer.planName)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span>Select & Enroll in this Plan</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
