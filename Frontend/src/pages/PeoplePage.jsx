import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Key,
  Briefcase,
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  AlertCircle,
  Building,
  Mail,
  Phone,
  Calendar,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { getAllUsersApi } from '../api/auth.api.js';
import UserDetailsModal from './UserDetailsModal.jsx';

export default function PeoplePage({ currentUser, onNavigateToTab }) {
  // Check whether role in localStorage is admin
  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || currentUser;
    } catch {
      return currentUser;
    }
  })();

  const isAdmin =
    savedUser?.role === 'COMPANY_ADMIN' || savedUser?.role === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAllUsersApi();
      setUsers(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Compute breakdown stats per role
  const totalCount = users.length;
  const companyAdminCount = users.filter((u) => u.role === 'COMPANY_ADMIN').length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const employeeCount = users.filter((u) => u.role === 'EMPLOYEE').length;
  const policyholderCount = users.filter((u) => u.role === 'POLICYHOLDER').length;

  // Filter users based on selected role tab and search query
  const filteredUsers = users.filter((user) => {
    // 1. Role filter
    if (selectedRole !== 'ALL' && user.role !== selectedRole) {
      return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = user.name?.toLowerCase().includes(q);
      const matchEmail = user.email?.toLowerCase().includes(q);
      const matchCustId = user.customerId?.toLowerCase().includes(q);
      const matchEmpId = user.employeeId?.toLowerCase().includes(q);
      const matchPolicy = user.policies?.some((p) =>
        p.policyName?.toLowerCase().includes(q)
      );
      const matchDept = user.department?.toLowerCase().includes(q);
      return matchName || matchEmail || matchCustId || matchEmpId || matchPolicy || matchDept;
    }

    return true;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'COMPANY_ADMIN':
        return {
          label: 'Company Admin',
          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
        };
      case 'ADMIN':
        return {
          label: 'System Admin',
          color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
        };
      case 'EMPLOYEE':
        return {
          label: 'Staff / Adjuster',
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

  // If role is not admin in localStorage, restrict access
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 inline-block">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-xs text-slate-400">
          Your current account role ({savedUser?.role || 'POLICYHOLDER'}) does not have
          administrative privileges to view platform user directories.
        </p>
        <button
          onClick={() => onNavigateToTab('home')}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Admin Control Center</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            People & Role Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor registered platform users, inspect authorization tiers, and manage permissions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        </div>
      </div>

      {/* Notice alert */}
      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Role Breakdown Clickable Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* All Users Card */}
        <div
          onClick={() => setSelectedRole('ALL')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            selectedRole === 'ALL'
              ? 'bg-slate-800/90 border-sky-500 ring-2 ring-sky-500/30 shadow-lg shadow-sky-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">All People</span>
            <div className="p-1.5 bg-slate-800 rounded-lg text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">{totalCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Total Registered</p>
        </div>

        {/* Company Admin Card */}
        <div
          onClick={() => setSelectedRole('COMPANY_ADMIN')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            selectedRole === 'COMPANY_ADMIN'
              ? 'bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-300">Company Admin</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-400 mt-2">{companyAdminCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Executive Level</p>
        </div>

        {/* System Admin Card */}
        <div
          onClick={() => setSelectedRole('ADMIN')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            selectedRole === 'ADMIN'
              ? 'bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-300">System Admin</span>
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-indigo-400 mt-2">{adminCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Platform Root</p>
        </div>

        {/* Employee Card */}
        <div
          onClick={() => setSelectedRole('EMPLOYEE')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            selectedRole === 'EMPLOYEE'
              ? 'bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-300">Staff / Staff</span>
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-400 mt-2">{employeeCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Underwriting & Claims</p>
        </div>

        {/* Policyholder Card */}
        <div
          onClick={() => setSelectedRole('POLICYHOLDER')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            selectedRole === 'POLICYHOLDER'
              ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300">Policyholders</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">{policyholderCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Subscribed Insured</p>
        </div>
      </div>

      {/* Filter Tabs Bar & Search */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, customer ID, employee ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Horizontal Role Selector Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All', count: totalCount },
            { id: 'COMPANY_ADMIN', label: 'Company Admin', count: companyAdminCount },
            { id: 'ADMIN', label: 'System Admin', count: adminCount },
            { id: 'EMPLOYEE', label: 'Staff', count: employeeCount },
            { id: 'POLICYHOLDER', label: 'Policyholder', count: policyholderCount }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedRole(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                selectedRole === tab.id
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedRole === tab.id
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tab.count}
              </span>
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

      {/* Users List Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-3">
          <div className="p-4 bg-slate-800/60 rounded-2xl text-slate-400 inline-block">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-white">No Users Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No user matching "${searchQuery}" was found under role: ${selectedRole}.`
              : `No users have been registered under role: ${selectedRole}.`}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">User / Contact</th>
                  <th className="px-6 py-3.5">System Role</th>
                  <th className="px-6 py-3.5">Identifiers & Details</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Registered</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isCurrentUser = u._id === savedUser?._id;
                  const isDeleting = deletingId === u._id;

                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                            {u.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white group-hover:text-sky-300 transition-colors">
                                {u.name}
                              </span>
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleBadge.color}`}
                        >
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Identifiers */}
                      <td className="px-6 py-4 text-slate-300">
                        {u.role === 'POLICYHOLDER' ? (
                          <div className="space-y-0.5">
                            <p className="text-[11px]">
                              Cust ID:{' '}
                              <strong className="text-sky-400 font-mono">
                                {u.customerId || 'CUST-NONE'}
                              </strong>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Policies:{' '}
                              <span className="font-semibold text-emerald-400">
                                {u.policies?.length > 1
                                  ? `${u.policies[0].policyName} (+${u.policies.length - 1} more)`
                                  : u.policies?.[0]?.policyName || 'None'}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="text-[11px]">
                              Emp ID:{' '}
                              <strong className="text-blue-400 font-mono">
                                {u.employeeId || 'EMP-ADMIN'}
                              </strong>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Dept:{' '}
                              <span className="text-slate-300">
                                {u.department || 'Executive'}
                              </span>
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedUserForModal(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Inspect User Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Inspector */}
      {selectedUserForModal && (
        <UserDetailsModal
          user={selectedUserForModal}
          onClose={() => setSelectedUserForModal(null)}
        />
      )}
    </div>
  );
}
