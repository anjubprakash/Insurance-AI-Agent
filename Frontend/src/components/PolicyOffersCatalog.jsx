import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  Building,
  Info
} from 'lucide-react';
import { listPolicyOffersApi, deletePolicyOfferApi } from '../api/documents.api.js';
import EditPolicyOfferModal from './EditPolicyOfferModal.jsx';
import DeleteConfirmModal from './DeleteConfirmModal.jsx';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'AUTO', label: 'Auto & Motor' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'HOME', label: 'Home & Property' },
  { value: 'LIFE', label: 'Life' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'AGRICULTURE', label: 'Agriculture' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'GENERAL', label: 'General' }
];

export default function PolicyOffersCatalog({ isAdmin, parentDocId = null }) {
  const [offers, setOffers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerToDelete, setOfferToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchOffers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory) params.policyCategory = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      if (parentDocId) params.parentDocumentId = parentDocId;

      const res = await listPolicyOffersApi(params);
      const data = res.data;
      setOffers(data.offers || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch policy offers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [selectedCategory, parentDocId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOffers();
  };

  const handleDelete = (offer) => {
    setOfferToDelete(offer);
  };

  const handleConfirmDeleteOffer = async () => {
    if (!offerToDelete) return;
    const offer = offerToDelete;
    setDeletingId(offer._id);
    try {
      await deletePolicyOfferApi(offer._id);
      setNotification(`Deleted policy offer ${offer.policyReferenceCode} and removed its Qdrant vector point.`);
      setTimeout(() => setNotification(null), 3500);
      setOffers((prev) => prev.filter((o) => o._id !== offer._id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setOfferToDelete(null);
    } catch (err) {
      alert(`Failed to delete offer: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
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
      case 'ACCIDENT':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'AGRICULTURE':
        return 'bg-lime-500/15 text-lime-400 border-lime-500/30';
      case 'COMMERCIAL':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code (e.g. INS001), plan name, insurer, or deductible..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </form>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-slate-900 text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchOffers}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50 transition-colors"
            title="Refresh Offers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Offers Table */}
      {isLoading ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading granular policy offers & Qdrant vectors...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Policy Offers Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload an Excel workbook (like 30_fictional_insurance_offers.xlsx) in the Upload page.
            The backend will disaggregate every row into an independent policy offer.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-white">{totalCount} Policy Offers</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Independently Vectorized & Editable</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code / ID</th>
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Insurer</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Cover Limit</th>
                  <th className="py-3 px-4">Excess / Deductible</th>
                  <th className="py-3 px-4">Premium</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {offers.map((offer) => (
                  <tr
                    key={offer._id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-400">
                      {offer.policyReferenceCode}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white group-hover:text-sky-300 transition-colors">
                        {offer.planName}
                      </div>
                      {offer.coverageSubtype && (
                        <div className="text-[11px] text-slate-500">{offer.coverageSubtype}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Building className="w-3 h-3 text-slate-500" />
                        <span>{offer.insurer}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(
                          offer.policyCategory
                        )}`}
                      >
                        {offer.policyCategory}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {offer.annualCoverageAmount || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {offer.excessDeductible || '—'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {offer.illustrativePremium || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingOffer(offer)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-semibold transition-colors"
                          title="Edit Policy Terms & Resync Vector"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(offer)}
                            disabled={deletingId === offer._id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Policy Offer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Policy Offer Modal */}
      {editingOffer && (
        <EditPolicyOfferModal
          offer={editingOffer}
          onClose={() => setEditingOffer(null)}
          onUpdated={(updated) => {
            setOffers((prev) => prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o)));
            setNotification(`Policy offer '${updated.policyReferenceCode}' updated and re-indexed in Qdrant!`);
            setTimeout(() => setNotification(null), 3500);
          }}
        />
      )}

      {/* Confirmation Modal for Policy Offer Deletion */}
      <DeleteConfirmModal
        isOpen={Boolean(offerToDelete)}
        onClose={() => !deletingId && setOfferToDelete(null)}
        onConfirm={handleConfirmDeleteOffer}
        title="Delete Policy Offer?"
        itemTitle={offerToDelete?.planName}
        itemCode={offerToDelete?.policyReferenceCode}
        itemType="Policy Offer"
        isDeleting={Boolean(deletingId)}
        isBatchCatalogue={false}
        totalOffersCount={0}
      />
    </div>
  );
}
