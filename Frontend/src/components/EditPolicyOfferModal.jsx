import React, { useState } from 'react';
import {
  X,
  Save,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Clock,
  Ban,
  Activity
} from 'lucide-react';
import { updatePolicyOfferApi } from '../api/documents.api.js';

export default function EditPolicyOfferModal({ offer, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    planName: offer?.planName || '',
    insurer: offer?.insurer || '',
    policyCategory: offer?.policyCategory || 'GENERAL',
    coverageSubtype: offer?.coverageSubtype || '',
    annualCoverageAmount: offer?.annualCoverageAmount || '',
    excessDeductible: offer?.excessDeductible || '',
    illustrativePremium: offer?.illustrativePremium || '',
    benefitSublimits: offer?.benefitSublimits || '',
    waitingPeriods: offer?.waitingPeriods || '',
    exclusions: offer?.exclusions || '',
    claimsProcess: offer?.claimsProcess || '',
    status: offer?.status || 'ACTIVE'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  if (!offer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await updatePolicyOfferApi(offer._id, formData);
      setSaveSuccess(true);
      if (onUpdated) {
        onUpdated(res.data?.offer || { ...offer, ...formData });
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to update policy offer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold">
                  {offer.policyReferenceCode}
                </span>
                <span className="text-xs text-slate-400">
                  {offer.sourceSheet} • Row {offer.sourceRowIndex}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                Edit Policy Offer & Resync Qdrant Vector
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {saveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Policy Updated & Re-indexed Successfully!</p>
                <p className="text-emerald-400/80">
                  Updated attributes were saved to MongoDB and vector point in Qdrant was refreshed in real-time.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Plan / Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.planName}
                onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Insurer / Carrier
              </label>
              <input
                type="text"
                value={formData.insurer}
                onChange={(e) => setFormData({ ...formData, insurer: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Policy Category
              </label>
              <select
                value={formData.policyCategory}
                onChange={(e) => setFormData({ ...formData, policyCategory: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="HEALTH">Health & Medical</option>
                <option value="AUTO">Motor & Auto</option>
                <option value="HOME">Home & Property</option>
                <option value="LIFE">Life & Annuity</option>
                <option value="ACCIDENT">Accident</option>
                <option value="AGRICULTURE">Agriculture & Crop</option>
                <option value="COMMERCIAL">Commercial & Liability</option>
                <option value="GENERAL">General Guidelines</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Coverage Subtype
              </label>
              <input
                type="text"
                value={formData.coverageSubtype}
                onChange={(e) => setFormData({ ...formData, coverageSubtype: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. Individual medical, Comprehensive"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Annual / Max Coverage Limit
              </label>
              <input
                type="text"
                value={formData.annualCoverageAmount}
                onChange={(e) => setFormData({ ...formData, annualCoverageAmount: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. £100,000"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 text-amber-400">
                Excess / Deductible per Claim
              </label>
              <input
                type="text"
                value={formData.excessDeductible}
                onChange={(e) => setFormData({ ...formData, excessDeductible: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-500/30 rounded-xl text-xs text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. £250 per claim"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Illustrative Premium
              </label>
              <input
                type="text"
                value={formData.illustrativePremium}
                onChange={(e) => setFormData({ ...formData, illustrativePremium: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="e.g. £42/month"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lifecycle Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ACTIVE">ACTIVE (Indexed in RAG)</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Waiting Periods
            </label>
            <input
              type="text"
              value={formData.waitingPeriods}
              onChange={(e) => setFormData({ ...formData, waitingPeriods: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. 30 days general illness; 12 months specified procedures"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Benefit Sub-limits
            </label>
            <input
              type="text"
              value={formData.benefitSublimits}
              onChange={(e) => setFormData({ ...formData, benefitSublimits: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. Outpatient £500/year; Dental £300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Exclusions / Limitations
            </label>
            <textarea
              rows={2}
              value={formData.exclusions}
              onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              placeholder="e.g. Routine dental/optical; cosmetic care; fertility treatment"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Claims / FNOL Procedure
            </label>
            <textarea
              rows={2}
              value={formData.claimsProcess}
              onChange={(e) => setFormData({ ...formData, claimsProcess: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              placeholder="e.g. Pre-authorise planned admissions; submit invoices within 30 days"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <p className="text-[11px] text-slate-500 flex items-center">
              <Cpu className="w-3.5 h-3.5 mr-1 text-sky-400" />
              Saves to MongoDB and regenerates 384-dim Qdrant vector point in real-time.
            </p>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-50 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving & Vectorizing...' : 'Save & Update Vector'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
