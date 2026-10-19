import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  RotateCcw,
  WifiOff,
  FileWarning,
  X,
  Database
} from 'lucide-react';

export default function AiGatekeeperModal({
  isOpen,
  onClose,
  isProcessing,
  progress = 0,
  currentFileName = '',
  currentPolicyType = 'AUTO',
  customStageSubtitle = '',
  result,
  isError,
  errorMessage,
  onResetForm,
  onViewDocuments
}) {
  if (!isOpen) return null;

  const errLower = (errorMessage || '').toLowerCase();

  const isNetworkOrOffline =
    errLower.includes('network error') ||
    errLower.includes('failed to fetch') ||
    errLower.includes('offline') ||
    errLower.includes('unreachable') ||
    errLower.includes('unavailable') ||
    errLower.includes('503') ||
    errLower.includes('econnrefused') ||
    errLower.includes('connection refused');

  const isDuplicate =
    errLower.includes('duplicate') ||
    errLower.includes('already registered') ||
    errLower.includes('already present') ||
    errLower.includes('already indexed');

  const isEmptyOrUnreadable =
    errLower.includes('empty') ||
    errLower.includes('unreadable') ||
    errLower.includes('could not parse') ||
    errLower.includes('unsupported file') ||
    errLower.includes('no text content');

  const isGatekeeperRejection =
    !isNetworkOrOffline &&
    !isDuplicate &&
    !isEmptyOrUnreadable;

  const formatSimpleRejectionReason = (rawReason) => {
    if (!rawReason) {
      return 'The uploaded document does not meet official Insurance Policy or Claims criteria and cannot be indexed.';
    }

    let cleaned = rawReason
      .replace(/^ai gatekeeper rejected document:\s*/i, '')
      .replace(/^ai gatekeeper rejected:\s*/i, '')
      .trim();

    cleaned = cleaned.replace(/^the sampled checkpoints (describe|indicate|show|contain)\s+/i, 'The document was identified as ');
    cleaned = cleaned.replace(/^sampled checkpoints (describe|indicate|show|contain)\s+/i, 'The document was identified as ');
    cleaned = cleaned.replace(/\s*therefore it is not an official or relevant insurance document and must be rejected\.?/i, '');
    cleaned = cleaned.replace(/\s*therefore,? it must be rejected\.?/i, '');

    return cleaned;
  };

  const cleanGatekeeperReason = errorMessage
    ? formatSimpleRejectionReason(errorMessage)
    : 'The uploaded document does not meet standard Insurance Policy guidelines and cannot be indexed into the knowledge base.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Dynamic Header Ribbon */}
        <div
          className={`h-2 w-full ${
            isProcessing
              ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 animate-pulse'
              : !isError
              ? 'bg-emerald-500'
              : isDuplicate
              ? 'bg-blue-500'
              : isNetworkOrOffline
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
        />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-2xl ${
                isProcessing
                  ? 'bg-sky-500/10 text-sky-400'
                  : !isError
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : isDuplicate
                  ? 'bg-blue-500/15 text-blue-400'
                  : isNetworkOrOffline
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {isProcessing ? (
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              ) : !isError ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isDuplicate ? (
                <FileWarning className="w-6 h-6" />
              ) : isNetworkOrOffline ? (
                <WifiOff className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {isProcessing
                  ? 'AI Gatekeeper Verification'
                  : !isError
                  ? 'Policy Validated & Indexed'
                  : isDuplicate
                  ? 'Duplicate Policy Detected'
                  : isNetworkOrOffline
                  ? 'Vector Engine Connection Notice'
                  : 'AI Gatekeeper Rejected Document'}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                {currentFileName || 'Insurance Document'}
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs overflow-y-auto max-h-[70vh]">
          {/* 1. In Processing State */}
          {isProcessing && (
            <div className="space-y-6 py-4">
              {/* Circular / Linear Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {customStageSubtitle || 'Processing through AI ingestion pipeline...'}
                  </span>
                  <span className="font-mono font-bold text-sky-400 text-sm">
                    {progress}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* 4 Steps Indicator */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-[10px] text-center">
                <div className={`p-2 rounded-xl border ${progress >= 15 ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <FileText className="w-3.5 h-3.5 mx-auto mb-1" />
                  <span>1. Parsing</span>
                </div>
                <div className={`p-2 rounded-xl border ${progress >= 30 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 mx-auto mb-1" />
                  <span>2. Gatekeeper</span>
                </div>
                <div className={`p-2 rounded-xl border ${progress >= 60 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <Layers className="w-3.5 h-3.5 mx-auto mb-1" />
                  <span>3. Chunking</span>
                </div>
                <div className={`p-2 rounded-xl border ${progress >= 95 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <Database className="w-3.5 h-3.5 mx-auto mb-1" />
                  <span>4. Qdrant</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Success State */}
          {!isProcessing && !isError && result && (
            <div className="space-y-5">
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-emerald-400" />
                    AI Gatekeeper Verified & Approved
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {Math.round((result.gatekeeper?.confidenceScore || 0.95) * 100)}% Confidence
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                  {result.gatekeeper?.reasoning || 'Document authenticated as official insurance policy wording.'}
                </p>
              </div>

              {/* Statistics Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400">Semantic Clauses</span>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">
                    {result.document?.chunkCount || 0}
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400">Total RAG Tokens</span>
                  <p className="text-lg font-bold text-purple-400 mt-0.5">
                    ~{(result.document?.totalRagTokens || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400">Policy Category</span>
                  <p className="text-sm font-bold text-white mt-1">
                    {result.document?.policyType || currentPolicyType}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Error / Rejected / Duplicate State */}
          {!isProcessing && isError && (
            <div className="space-y-4">
              {isDuplicate ? (
                <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-4 space-y-2 text-slate-300">
                  <h3 className="font-bold text-blue-300 text-sm flex items-center">
                    <FileWarning className="w-4 h-4 mr-1.5" />
                    Duplicate Policy Already Indexed
                  </h3>
                  <p className="leading-relaxed">
                    This document matches an existing policy with identical SHA-256 fingerprint.
                    Duplicate chunks are rejected to prevent vector index redundancy.
                  </p>
                </div>
              ) : isGatekeeperRejection ? (
                <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-4 space-y-2 text-slate-300">
                  <h3 className="font-bold text-red-300 text-sm flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1.5" />
                    AI Gatekeeper Rejected Document
                  </h3>
                  <p className="leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-red-200">
                    {cleanGatekeeperReason}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-2 text-slate-300">
                  <h3 className="font-bold text-amber-300 text-sm flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                    Ingestion Error Notice
                  </h3>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          {!isProcessing && (
            <>
              <button
                onClick={() => {
                  if (onResetForm) onResetForm();
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Another</span>
              </button>

              {!isError && (
                <button
                  onClick={() => {
                    onClose();
                    if (onViewDocuments) onViewDocuments();
                  }}
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold transition-all shadow-md shadow-sky-500/20"
                >
                  <span>View in Document Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
