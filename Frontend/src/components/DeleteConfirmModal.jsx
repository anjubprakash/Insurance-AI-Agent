import React from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  RefreshCw
} from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Document',
  itemTitle = '',
  itemCode = '',
  itemType = 'Document',
  isDeleting = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {title}
              </h2>
              <p className="text-[11px] text-slate-400">
                Confirm permanent removal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete this {itemType.toLowerCase()}?
            </p>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
              <p className="text-sm font-bold text-white line-clamp-2">
                {itemTitle || 'Untitled Item'}
              </p>
              {itemCode && (
                <p className="text-[11px] font-mono text-sky-400">
                  Ref Code: {itemCode}
                </p>
              )}
            </div>
          </div>

          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-300 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>This action is irreversible. The AI agent will no longer cite or recommend this {itemType.toLowerCase()}.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>OK, Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
