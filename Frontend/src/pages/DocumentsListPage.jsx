import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Eye,
  UploadCloud,
  Layers,
  ShieldCheck,
  Cpu,
  AlertCircle,
  HardDrive,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { listDocumentsApi, deleteDocumentApi } from '../api/documents.api.js';
import DocumentDetailsModal from './DocumentDetailsModal.jsx';
import PolicyOffersCatalog from '../components/PolicyOffersCatalog.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import { FileSpreadsheet } from 'lucide-react';

const FILTER_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'AUTO', label: 'Auto & Motor' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'HOME', label: 'Home' },
  { value: 'LIFE', label: 'Life' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'GENERAL', label: 'General' }
];

export default function DocumentsListPage({ onNavigateToUpload, isAdmin }) {
  const [activeTab, setActiveTab] = useState('DOCUMENTS'); // 'DOCUMENTS' | 'OFFERS'
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ totalWordCount: 0, totalChunks: 0, totalRagTokens: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDocForModal, setSelectedDocForModal] = useState(null);
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory) params.policyType = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const response = await listDocumentsApi(params);
      const data = response.data;
      setDocuments(data.documents || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err.message || 'Failed to load policy documents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleDelete = (doc) => {
    setDocToDelete(doc);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    const doc = docToDelete;
    setDeletingId(doc._id);
    try {
      await deleteDocumentApi(doc._id);
      setActionNotice(`Successfully deleted "${doc.title}" along with its Qdrant vectors and database records.`);
      setTimeout(() => setActionNotice(null), 5000);
      setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
      setDocToDelete(null);
      if (selectedDocForModal?._id === doc._id) {
        setSelectedDocForModal(null);
      }
    } catch (err) {
      alert(`Error deleting document: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryColor = (type) => {
    switch (type) {
      case 'AUTO':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'HEALTH':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'HOME':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'LIFE':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'COMMERCIAL':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Policy Knowledge Repository</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            All Ingested Policy Documents
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and inspect verified insurance policies indexed into the Qdrant vector database.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={onNavigateToUpload}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-xs font-bold text-white transition-all shadow-md shadow-sky-500/20"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Policy Documents</p>
            <p className="text-xl font-bold text-white mt-0.5">{documents.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Vector Clauses Indexed</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {stats.totalChunks || documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">RAG Tokens Active</p>
            <p className="text-xl font-bold text-white mt-0.5">
              ~{(stats.totalRagTokens || documents.reduce((acc, d) => acc + (d.totalRagTokens || 0), 0)).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation: Master Documents vs Granular Policy Offers */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'DOCUMENTS'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Source Policy Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('OFFERS')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'OFFERS'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Granular Policy Offers & Plans</span>
          <span className="px-1.5 py-0.5 rounded-md bg-purple-500/30 text-[10px] text-purple-200 font-mono">
            Editable Qdrant Points
          </span>
        </button>
      </div>

      {activeTab === 'OFFERS' ? (
        <PolicyOffersCatalog isAdmin={isAdmin} />
      ) : (
        <>
          {/* Notice Alert if any */}
          {actionNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, policy code, or file name..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </form>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3 text-xs text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-4">
          <div className="p-4 bg-slate-800/60 rounded-2xl text-slate-400 inline-block">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Policy Documents Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || selectedCategory
                ? 'Try adjusting your search filters or clearing the category filter.'
                : 'Upload your first insurance policy document to populate the AI vector index.'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={onNavigateToUpload}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-sky-500/20"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document Now</span>
            </button>
          )}
        </div>
      ) : (
        /* Document Cards / Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isDeleting = deletingId === doc._id;
            return (
              <div
                key={doc._id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all group hover:shadow-lg hover:shadow-sky-500/5"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryColor(
                          doc.policyType
                        )}`}
                      >
                        {doc.policyType}
                      </span>
                      {doc.isBatchCatalogue && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <FileSpreadsheet className="w-3 h-3 mr-1" />
                          <span>Catalogue ({doc.totalOffersCount || 0} Offers)</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        doc.gatekeeperStatus === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      {doc.gatekeeperStatus || 'APPROVED'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                      {doc.title}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {doc.policyCode || 'NO-REF'} • v{doc.version || '1.0'}
                    </p>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {doc.lineOfBusiness || 'Personal & Commercial Lines'}
                  </p>
                </div>

                {/* Metrics */}
                <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center text-slate-400">
                      <Layers className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                      <span>{doc.chunkCount || 0} Clauses</span>
                    </div>
                    <div className="flex items-center text-slate-400">
                      <Cpu className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                      <span>~{(doc.totalRagTokens || 0).toLocaleString()} Tokens</span>
                    </div>
                    <div className="flex items-center text-slate-400">
                      <HardDrive className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      <span>{doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-slate-400">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setSelectedDocForModal(doc)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={isDeleting}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Document"
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span className="text-xs">Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </>
      )}

      {/* Modal Inspector */}
      {selectedDocForModal && (
        <DocumentDetailsModal
          document={selectedDocForModal}
          isAdmin={isAdmin}
          onClose={() => setSelectedDocForModal(null)}
          onDeleteDocument={(doc) => {
            setDocToDelete(doc);
          }}
        />
      )}

      {/* Confirmation Modal for Document Deletion */}
      <DeleteConfirmModal
        isOpen={Boolean(docToDelete)}
        onClose={() => !deletingId && setDocToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Policy Document?"
        itemTitle={docToDelete?.title}
        itemCode={docToDelete?.policyCode}
        itemType="Policy Document"
        isDeleting={Boolean(deletingId)}
        isBatchCatalogue={Boolean(docToDelete?.isBatchCatalogue)}
        totalOffersCount={docToDelete?.totalOffersCount || 0}
      />
    </div>
  );
}
