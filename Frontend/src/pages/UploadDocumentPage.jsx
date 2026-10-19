import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileText,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
  X,
  FileCheck,
  FileWarning,
  FileSpreadsheet,
  Plus,
  Trash2,
  Sparkles
} from 'lucide-react';
import { uploadDocumentApi, getUploadProgressApi, listDocumentsApi } from '../api/documents.api.js';
import AiGatekeeperModal from '../components/AiGatekeeperModal.jsx';

export const POLICY_TYPES = [
  { value: 'AUTO', label: 'Motor & Auto Insurance', color: 'text-blue-400' },
  { value: 'HEALTH', label: 'Health & Medical', color: 'text-emerald-400' },
  { value: 'HOME', label: 'Home & Property', color: 'text-amber-400' },
  { value: 'LIFE', label: 'Life & Annuity', color: 'text-purple-400' },
  { value: 'COMMERCIAL', label: 'Commercial & Liability', color: 'text-indigo-400' },
  { value: 'GENERAL', label: 'General / P&C Guidelines', color: 'text-slate-400' },
  { value: 'MULTIPLE', label: 'Multi-Category Catalogue (Auto-Detected per Row)', color: 'text-purple-400' }
];

export default function UploadDocumentPage({ onUploadSuccess, onViewDocuments }) {
  // Support multi-file queue
  const [fileQueue, setFileQueue] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    policyType: 'AUTO',
    lineOfBusiness: 'Personal Lines',
    policyCode: '',
    version: '1.0'
  });

  const [existingDocs, setExistingDocs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [stageSubtitle, setStageSubtitle] = useState('');
  const [gatekeeperResult, setGatekeeperResult] = useState(null);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pollingRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check if any queued file is an Excel spreadsheet (.xlsx, .xls, .csv)
  const hasSpreadsheetInQueue = useMemo(() => {
    return fileQueue.some((f) => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return ['.xlsx', '.xls', '.csv'].includes(ext);
    });
  }, [fileQueue]);

  // When a spreadsheet is detected, automatically switch policyType to MULTIPLE
  useEffect(() => {
    if (hasSpreadsheetInQueue) {
      setFormData((prev) => ({
        ...prev,
        policyType: 'MULTIPLE',
        lineOfBusiness: 'Multi-Line Insurance Catalogue'
      }));
    }
  }, [hasSpreadsheetInQueue]);

  // Fetch existing documents to detect duplicates in real-time
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await listDocumentsApi();
        setExistingDocs(res.data?.documents || []);
      } catch (_) {}
    };
    fetchExisting();
  }, []);

  const duplicateMatch = useMemo(() => {
    if (!existingDocs || existingDocs.length === 0 || fileQueue.length === 0) return null;
    const firstFile = fileQueue[0];
    const curName = firstFile?.name?.toLowerCase().trim();
    const curTitle = formData.title?.toLowerCase().trim();
    const curCode = formData.policyCode?.toLowerCase().trim();

    return existingDocs.find((doc) => {
      if (doc.status !== 'INDEXED') return false;
      const docName = (doc.originalFileName || '').toLowerCase().trim();
      const docTitle = (doc.title || '').toLowerCase().trim();
      const docCode = (doc.policyCode || '').toLowerCase().trim();

      if (curName && docName && curName === docName) return true;
      if (curTitle && docTitle && curTitle === docTitle) return true;
      if (curCode && docCode && curCode === docCode) return true;
      return false;
    });
  }, [existingDocs, fileQueue, formData.title, formData.policyCode]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Helper to validate and append files to the queue
  const addFilesToQueue = (incomingFiles) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.csv'];
    const valid = [];

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (allowed.includes(ext)) {
        // Prevent adding duplicate identical filenames in current queue
        if (!fileQueue.some((f) => f.name === file.name && f.size === file.size)) {
          valid.push(file);
        }
      } else {
        alert(`Unsupported file format (${file.name}). Supported: PDF, Word, Excel (.xlsx, .xls, .csv), and Text.`);
      }
    }

    if (valid.length > 0) {
      const updatedQueue = [...fileQueue, ...valid];
      setFileQueue(updatedQueue);
      setIsError(false);
      setErrorMessage('');

      // Auto-populate Title if empty from the first file
      if (!formData.title) {
        const cleanName = valid[0].name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setFormData((prev) => ({
          ...prev,
          title: cleanName,
          policyCode: prev.policyCode || `POL-${Math.floor(1000 + Math.random() * 9000)}`
        }));
      }
    }
  };

  // Handle user selecting files via file browser dialog
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToQueue(Array.from(files));
    }
  };

  // Handle user dropping files directly into the drag & drop zone
  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFilesToQueue(Array.from(files));
    }
  };

  // Remove a specific file from the queue
  const removeFileFromQueue = (indexToRemove) => {
    const updated = fileQueue.filter((_, idx) => idx !== indexToRemove);
    setFileQueue(updated);
    if (updated.length === 0) {
      setFormData((prev) => ({ ...prev, title: '', policyCode: '' }));
    }
  };

  // Upload handler supporting single file or sequential batch queue
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fileQueue.length === 0) {
      alert('Please choose or drop at least one insurance policy file (.pdf, .docx, .xlsx, or .txt).');
      return;
    }

    setModalOpen(true);
    setIsProcessing(true);
    setUploadPercent(10);
    setStageSubtitle('Transmitting file(s) and running AI Gatekeeper...');
    setIsError(false);
    setErrorMessage('');
    setGatekeeperResult(null);

    const totalFiles = fileQueue.length;
    let lastUploadedDoc = null;

    for (let i = 0; i < totalFiles; i++) {
      const currentFile = fileQueue[i];
      const isMulti = totalFiles > 1;
      const fileLabel = `[${i + 1}/${totalFiles}] ${currentFile.name}`;

      const uploadId = `upload_${Date.now()}_${i}`;
      const payload = new FormData();
      payload.append('file', currentFile);
      payload.append(
        'title',
        isMulti
          ? currentFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
          : formData.title || currentFile.name
      );
      payload.append('policyType', formData.policyType);
      payload.append('lineOfBusiness', formData.lineOfBusiness);
      payload.append('policyCode', isMulti ? `POL-${Date.now()}-${i + 1}` : formData.policyCode);
      payload.append('version', formData.version);
      payload.append('uploadId', uploadId);

      // Start progress polling
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const progRes = await getUploadProgressApi(uploadId);
          const data = progRes.data;
          if (data && typeof data.percent === 'number') {
            const basePct = Math.round((i / totalFiles) * 100);
            const fileContrib = Math.round((data.percent / totalFiles));
            setUploadPercent(Math.max(10, basePct + fileContrib));
            if (data.message) {
              setStageSubtitle(`${fileLabel}: ${data.message}`);
            }
            if (data.status === 'READY' || data.percent >= 100) {
              stopPolling();
            }
          }
        } catch (_) {}
      }, 450);

      try {
        const response = await uploadDocumentApi(payload, (pct) => {
          const basePct = Math.round((i / totalFiles) * 100);
          const fileContrib = Math.round((pct / totalFiles) * 0.4);
          setUploadPercent(Math.max(10, basePct + fileContrib));
          setStageSubtitle(`${fileLabel}: AI Gatekeeper analyzing policy authenticity...`);
        });

        stopPolling();
        lastUploadedDoc = response.data?.document;
        setGatekeeperResult(response.data);
      } catch (err) {
        stopPolling();
        setIsProcessing(false);
        setIsError(true);
        setErrorMessage(`Error on ${currentFile.name}: ${err.message || 'Ingestion failed'}`);
        return;
      }
    }

    // All files processed successfully
    setUploadPercent(100);
    setIsProcessing(false);
    if (typeof onUploadSuccess === 'function' && lastUploadedDoc) {
      onUploadSuccess(lastUploadedDoc);
    }
  };

  const handleResetForm = () => {
    setFileQueue([]);
    setFormData({
      title: '',
      policyType: 'AUTO',
      lineOfBusiness: 'Personal Lines',
      policyCode: '',
      version: '1.0'
    });
    setModalOpen(false);
    setIsProcessing(false);
    setUploadPercent(0);
    setIsError(false);
    setErrorMessage('');
    setGatekeeperResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>Enterprise Knowledge Ingestion</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Ingest Insurance Policy Documents
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Upload single policies, schedules, or multi-offer Excel spreadsheets (.xlsx, .csv).
            The system executes AI Gatekeeper verification, auto-disaggregates batch tables into individual policies, and creates dedicated Qdrant vectors.
          </p>
        </div>
      </div>

      {/* Duplicate warning banner */}
      {duplicateMatch && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start space-x-3 text-xs text-blue-300">
          <FileWarning className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Matching Document Found in Vault</p>
            <p className="text-blue-300/90">
              "{duplicateMatch.title}" ({duplicateMatch.chunkCount || 0} clauses) is already indexed. Re-uploading identical content will be blocked by SHA-256 deduplication.
            </p>
          </div>
        </div>
      )}

      {/* Spreadsheet Batch Detection Banner */}
      {hasSpreadsheetInQueue && (
        <div className="p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-2xl flex items-start space-x-3 text-xs text-purple-200 shadow-lg shadow-purple-950/20 animate-fade-in">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white flex items-center">
              <span>Spreadsheet Batch Catalogue Mode Active</span>
              <span className="ml-2 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                Auto-Disaggregation
              </span>
            </p>
            <p className="text-purple-300/90 leading-relaxed">
              Every row in your spreadsheet will be parsed as an independent policy offer.
              The backend will detect insurance categories per row (Health, Motor, Home, etc.), assign or auto-generate policy reference codes (e.g., <code className="text-sky-300 font-mono">INS001</code> or <code className="text-sky-300 font-mono">POL-HLTH-001</code>), and index each offer with a dedicated vector in Qdrant. You can view, search, and edit individual policies in the Policy Catalog!
            </p>
          </div>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            fileQueue.length > 0
              ? 'border-emerald-500/50 bg-emerald-950/10'
              : 'border-slate-700 hover:border-sky-500/50 bg-slate-900/60 hover:bg-slate-900/90'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`p-4 rounded-2xl ${
                fileQueue.length > 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-sky-500/10 text-sky-400'
              }`}
            >
              {fileQueue.length > 0 ? (
                <FileCheck className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            {fileQueue.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-300">
                  {fileQueue.length} {fileQueue.length === 1 ? 'File Selected' : 'Files Queued'}
                </p>
                <p className="text-xs text-slate-400">
                  Click or drop additional files to add to the queue
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Drop insurance policy files here, or{' '}
                  <span className="text-sky-400 underline underline-offset-2">browse</span>
                </p>
                <p className="text-xs text-slate-500">
                  Supports Multi-File Upload: PDF (.pdf), Word (.docx), Excel (.xlsx, .xls, .csv), or Text (.txt) up to 25MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Queued Files List */}
        {fileQueue.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-300 flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                Upload Queue ({fileQueue.length} files)
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Files</span>
              </button>
            </div>

            <div className="space-y-2">
              {fileQueue.map((file, idx) => {
                const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                const isExcel = ['.xlsx', '.xls', '.csv'].includes(ext);

                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isExcel
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-sky-500/20 text-sky-400'
                        }`}
                      >
                        {isExcel ? (
                          <FileSpreadsheet className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB • {ext.toUpperCase().replace('.', '')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {isExcel && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                          Batch Offers
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFileFromQueue(idx);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata Inputs */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <Layers className="w-4 h-4 mr-2 text-sky-400" />
            Policy Metadata Specifications
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Policy Document Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Comprehensive Motor Policy Wording 2026 or 30 Fictional Insurance Offers"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Policy Category / Type *
              </label>
              <select
                value={formData.policyType}
                onChange={(e) => setFormData({ ...formData, policyType: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {POLICY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Policy Reference Code
              </label>
              <input
                type="text"
                value={formData.policyCode}
                onChange={(e) => setFormData({ ...formData, policyCode: e.target.value })}
                placeholder="e.g. POL-UK-AUTO-2026 (or auto-generated)"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Line of Business
              </label>
              <input
                type="text"
                value={formData.lineOfBusiness}
                onChange={(e) => setFormData({ ...formData, lineOfBusiness: e.target.value })}
                placeholder="e.g. Personal Motor Lines or Multi-Line Insurance Catalogue"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Version Release
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={fileQueue.length === 0}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-xs font-bold text-white transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {fileQueue.length > 1
                ? `Verify & Ingest All (${fileQueue.length} Files)`
                : hasSpreadsheetInQueue
                ? 'Verify & Ingest Batch Catalogue'
                : 'Verify & Ingest into Qdrant'}
            </span>
          </button>
        </div>
      </form>

      {/* AI Gatekeeper Modal */}
      <AiGatekeeperModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isProcessing={isProcessing}
        progressPercent={uploadPercent}
        stageSubtitle={stageSubtitle}
        gatekeeperResult={gatekeeperResult}
        isError={isError}
        errorMessage={errorMessage}
        onViewDocuments={onViewDocuments}
      />
    </div>
  );
}
