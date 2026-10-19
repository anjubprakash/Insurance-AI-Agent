import React from 'react';
import {
  X,
  User,
  Layers
} from 'lucide-react';

/**
 * UserDetailsModal Component
 *
 * Displays only the core user identity & confidential KYC details, along with
 * the user's subscribed policy names and PolicyDetail ObjectId references.
 * All policy-specific underwriting attributes are maintained in the PolicyDetail model.
 */
export default function UserDetailsModal({ user, onClose }) {
  if (!user) return null;

  // Role badges helper
  const getRoleBadge = (role) => {
    switch (role) {
      case 'COMPANY_ADMIN':
        return {
          label: 'Company Administrator',
          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
        };
      case 'ADMIN':
        return {
          label: 'System Admin',
          color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
        };
      case 'EMPLOYEE':
        return {
          label: 'Insurance Staff',
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
        };
      case 'POLICYHOLDER':
      default:
        return {
          label: 'Policyholder',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        };
    }
  };

  const badge = getRoleBadge(user.role);
  const policies = Array.isArray(user.policies) ? user.policies : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md border border-white/10">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-tight">{user.name}</h2>
                <span className={`px-2 py-0.2 rounded-full font-bold border text-[10px] ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center justify-center mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                {user.status || 'ACTIVE'}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Identifier</span>
              <span className="text-xs font-mono font-bold text-sky-400 mt-0.5 block truncate">
                {user.role === 'POLICYHOLDER'
                  ? user.customerId || 'CUST-AUTO'
                  : user.employeeId || 'EMP-ADMIN'}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Policies</span>
              <span className="text-xs font-bold text-white mt-0.5 block">
                {policies.length > 0 ? `${policies.length} Linked` : 'None'}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Language</span>
              <span className="text-xs font-bold text-purple-400 mt-0.5 block">
                {user.preferredLanguage || 'English'}
              </span>
            </div>
          </div>

          {/* Section 1: User Identity & Contact Particulars */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center">
              <User className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
              User Identity & Contact Particulars
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs divide-y sm:divide-y-0 divide-slate-800/60">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Full Name</span>
                <span className="font-semibold text-white">{user.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Email Address</span>
                <span className="font-semibold text-white">{user.email}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Phone Contact</span>
                <span className="text-slate-200">{user.phone || 'Not Provided'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Date of Birth / Age</span>
                <span className="text-slate-200">
                  {user.age ? `${user.age} Yrs` : ''}{' '}
                  {user.dateOfBirth ? `(${user.dateOfBirth})` : !user.age ? 'Not Provided' : ''}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Gender</span>
                <span className="text-slate-200">{user.gender || 'Not Specified'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">City & Pincode</span>
                <span className="text-slate-200">
                  {user.city ? `${user.city} - ${user.pincode || ''}` : 'Not Provided'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">KYC Document</span>
                <span className="text-slate-200 font-mono">
                  {user.idProofType || 'PENDING_AT_PURCHASE'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Data Consent</span>
                <span className="text-emerald-400 font-semibold">
                  {user.consentDataStore !== false ? 'Authorized' : 'Declined'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Subscribed Policies (Only Policy Name & ObjectId Reference) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Subscribed Policies ({policies.length})
              </h3>
            </div>

            {policies.length > 0 ? (
              <div className="space-y-2">
                {policies.map((p, idx) => {
                  const refId =
                    typeof p.policyId === 'object' && p.policyId !== null
                      ? p.policyId._id
                      : p.policyId;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-white">
                        {p.policyName || 'Insurance Plan'}
                      </span>
                      {refId && (
                        <span className="font-mono text-[10px] text-emerald-400">
                          Policy ID: {refId}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 text-xs italic bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                No policies linked to this user account yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
