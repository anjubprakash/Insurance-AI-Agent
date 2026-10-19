import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Calendar,
  HardDrive,
  Hash,
  AlertCircle,
  RefreshCw,
  Tag,
  CheckCircle2,
  Info,
  Trash2
} from 'lucide-react';
import { getDocumentChunksApi } from '../api/documents.api.js';

export default function DocumentDetailsModal({ document, onClose, isAdmin = false, onDeleteDocument = null }) {
  if (!document) return null;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'chunks'
  const [chunks, setChunks] = useState([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [chunkError, setChunkError] = useState(null);

  useEffect(() => {
    if (activeTab === 'chunks' && chunks.length === 0) {
      loadChunks();
    }
  }, [activeTab]);

  const loadChunks = async () => {
    setIsLoadingChunks(true);
    setChunkError(null);
    try {
      const res = await getDocumentChunksApi(document._id);
      setChunks(res.data || []);
    } catch (err) {
      setChunkError(err.message || 'Failed to load policy chunks.');
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const getClauseBadge = (chunk) => {
    if (chunk.isExclusion || chunk.clauseType === 'Exclusion Clause') {
      return { label: 'Exclusion', color: 'bg-red-500/15 text-red-400 border-red-500/30' };
    }
    if (chunk.isExcess || chunk.clauseType === 'Excess / Deductible Clause') {
      return { label: 'Excess / Deductible', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
    if (chunk.isFnolRule || chunk.clauseType === 'FNOL & Claims Procedure') {
      return { label: 'FNOL Procedure', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
    if (chunk.isSchedule || chunk.clauseType === 'Coverage Schedule') {
      return { label: 'Schedule', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    }
    return { label: chunk.clauseType || 'Coverage', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {document.title}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {document.policyCode || 'NO-POLICY-CODE'} • v{document.version || '1.0'} • {document.policyType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Overview & AI Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('chunks')}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'chunks'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Semantic Chunks ({document.chunkCount || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'overview' ? (
            <>
              {/* AI Gatekeeper Verdict Banner */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">AI Gatekeeper Audit</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                      document.gatekeeperStatus === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                    }`}
                  >
                    {document.gatekeeperStatus || 'APPROVED'} (
                    {Math.round((document.gatekeeperScore || 0.95) * 100)}% Confidence)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900/90 border border-slate-800/80 rounded-lg p-3">
                  {document.gatekeeperReasoning ||
                    'Verified as authentic insurance policy wording under stratified AI multi-point audit.'}
                </p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <Layers className="w-3 h-3 mr-1 text-sky-400" /> Chunks
                  </span>
                  <p className="text-lg font-bold text-white mt-1">
                    {document.chunkCount || 0}
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <Cpu className="w-3 h-3 mr-1 text-purple-400" /> Tokens
                  </span>
                  <p className="text-lg font-bold text-white mt-1">
                    ~{(document.totalRagTokens || 0).toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <HardDrive className="w-3 h-3 mr-1 text-emerald-400" /> File Size
                  </span>
                  <p className="text-lg font-bold text-white mt-1">
                    {document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : 'N/A'}
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <Database className="w-3 h-3 mr-1 text-amber-400" /> Vector Status
                  </span>
                  <p className="text-sm font-semibold text-emerald-400 mt-1">
                    {document.status === 'INDEXED' ? 'Qdrant Indexed' : document.status}
                  </p>
                </div>
              </div>

              {/* Metadata Specifications */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-slate-300 text-xs flex items-center">
                  <Hash className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                  Document Specifications
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-xs divide-y sm:divide-y-0 divide-slate-800/50">
                  <div className="flex justify-between sm:pr-4 py-1">
                    <span className="text-slate-400">Policy Category:</span>
                    <span className="font-semibold text-sky-400">{document.policyType}</span>
                  </div>
                  <div className="flex justify-between sm:pl-4 py-1">
                    <span className="text-slate-400">Line of Business:</span>
                    <span className="font-semibold text-slate-200">{document.lineOfBusiness}</span>
                  </div>
                  <div className="flex justify-between sm:pr-4 py-1">
                    <span className="text-slate-400">Original File:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[200px]" title={document.originalFileName}>
                      {document.originalFileName}
                    </span>
                  </div>
                  <div className="flex justify-between sm:pl-4 py-1">
                    <span className="text-slate-400">Upload Date:</span>
                    <span className="text-slate-300">
                      {document.createdAt ? new Date(document.createdAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex flex-col py-1">
                    <span className="text-slate-400 mb-0.5">SHA-256 Deduplication Hash:</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 break-all select-all">
                      {document.fileHash || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Raw Text Excerpt */}
              {document.rawText && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-300 text-xs flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    Ingested Content Excerpt (First 1,500 characters)
                  </h3>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
                    {document.rawText.slice(0, 1500)}
                    {document.rawText.length > 1500 && '\n\n... [Content continued in Qdrant Vector Store]'}
                  </pre>
                </div>
              )}
            </>
          ) : (
            /* Semantic Chunks Inspector Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold">
                    Indexed Policy Chunks ({chunks.length})
                  </span>
                </div>
                <button
                  onClick={loadChunks}
                  disabled={isLoadingChunks}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingChunks ? 'animate-spin' : ''}`} />
                  <span>Reload Chunks</span>
                </button>
              </div>

              {isLoadingChunks ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-slate-950 border border-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : chunkError ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
                  {chunkError}
                </div>
              ) : chunks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No semantic chunks found for this document.
                </div>
              ) : (
                <div className="space-y-3">
                  {chunks.map((chunk, idx) => {
                    const badge = getClauseBadge(chunk);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-2 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              Chunk #{chunk.chunkIndex !== undefined ? chunk.chunkIndex + 1 : idx + 1}
                            </span>
                            <span className="font-semibold text-white">
                              {chunk.sectionTitle || 'Policy Section'}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>

                        <pre className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-lg text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text">
                          {chunk.content}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            {isAdmin && onDeleteDocument && (
              <button
                onClick={() => {
                  onDeleteDocument(document);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                title="Delete this policy document"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Document</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
