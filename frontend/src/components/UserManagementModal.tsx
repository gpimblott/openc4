import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  Trash2,
  Check,
  AlertCircle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/ability';

interface ManagedUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  provider: string;
  createdAt: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const { authFetch, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'enterprise'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New user form state
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('editor');

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Failed to fetch users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleRoleChange = async (userId: number, role: UserRole) => {
    try {
      const res = await authFetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
        setSuccessMessage(`Updated role for user #${userId}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to update user role');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user '${username}'?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setSuccessMessage(`User '${username}' deleted`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to delete user');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) {
      setError('Please fill in username, email, and password');
      return;
    }

    try {
      const res = await authFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          displayName: newDisplayName || newUsername,
          password: newPassword,
          role: newRole
        })
      });

      if (res.ok) {
        setNewUsername('');
        setNewEmail('');
        setNewDisplayName('');
        setNewPassword('');
        setIsCreatingUser(false);
        setSuccessMessage('New user created successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchUsers();
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                User Management & RBAC
              </h2>
              <p className="text-xs text-slate-400">
                Manage accounts, assign roles with CASL authorization, and configure enterprise SSO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 flex items-center gap-4 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Role Assignments ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('enterprise')}
            className={`py-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'enterprise'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Enterprise SSO Integration (OIDC / SAML)</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'users' ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Registered Accounts</h3>
                  <p className="text-xs text-slate-400">
                    Individual users with assigned CASL capabilities
                  </p>
                </div>
                <button
                  onClick={() => setIsCreatingUser(!isCreatingUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isCreatingUser ? 'Cancel' : 'Add New User'}</span>
                </button>
              </div>

              {/* Create User Collapsible Form */}
              {isCreatingUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in duration-150"
                >
                  <h4 className="text-xs font-bold text-slate-200">Create New System Account</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. jsmith"
                        className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. jsmith@company.com"
                        className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Initial Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Assigned RBAC Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label
                        className={`p-2 rounded-xl border flex flex-col gap-0.5 cursor-pointer transition ${
                          newRole === 'viewer'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value="viewer"
                          checked={newRole === 'viewer'}
                          onChange={() => setNewRole('viewer')}
                          className="hidden"
                        />
                        <span className="text-xs font-bold">Viewer</span>
                        <span className="text-[10px] text-slate-400">Read only access</span>
                      </label>

                      <label
                        className={`p-2 rounded-xl border flex flex-col gap-0.5 cursor-pointer transition ${
                          newRole === 'editor'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-200'
                            : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value="editor"
                          checked={newRole === 'editor'}
                          onChange={() => setNewRole('editor')}
                          className="hidden"
                        />
                        <span className="text-xs font-bold">Editor (Architect)</span>
                        <span className="text-[10px] text-slate-400">Author & publish</span>
                      </label>

                      <label
                        className={`p-2 rounded-xl border flex flex-col gap-0.5 cursor-pointer transition ${
                          newRole === 'admin'
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                            : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value="admin"
                          checked={newRole === 'admin'}
                          onChange={() => setNewRole('admin')}
                          className="hidden"
                        />
                        <span className="text-xs font-bold">Admin</span>
                        <span className="text-[10px] text-slate-400">Full system control</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingUser(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-750 text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {isLoading && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Loading users...
                        </td>
                      </tr>
                    )}
                    {!isLoading && users.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-850/40 transition">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.displayName}</span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                          </td>

                          <td className="py-2.5 px-3 text-slate-300">{u.email}</td>

                          <td className="py-2.5 px-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              disabled={isSelf}
                              className={`bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none cursor-pointer ${
                                u.role === 'admin'
                                  ? 'text-purple-300 border-purple-500/30'
                                  : u.role === 'editor'
                                  ? 'text-blue-300 border-blue-500/30'
                                  : 'text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <option value="viewer" className="bg-slate-900 text-emerald-300">
                                Viewer (Read-only)
                              </option>
                              <option value="editor" className="bg-slate-900 text-blue-300">
                                Editor (Architect)
                              </option>
                              <option value="admin" className="bg-slate-900 text-purple-300">
                                Administrator
                              </option>
                            </select>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {u.provider}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              disabled={isSelf}
                              title={isSelf ? 'Cannot delete self' : 'Delete user'}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Enterprise SSO Setup Documentation Tab */
            <div className="space-y-5">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Enterprise OpenID Connect & SAML SSO
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    OpenC4 uses a pluggable authentication provider architecture (
                    <code className="text-cyan-300 font-mono text-[11px]">AuthProvider</code>). You can federate with enterprise identity providers such as **Microsoft Entra ID (Azure AD)**, **Okta**, **Keycloak**, **Google Workspace**, or **Ping Identity**.
                  </p>
                </div>
              </div>

              {/* Configuration Variables */}
              <div className="border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">
                  Standard Environment Configuration (.env)
                </h4>
                <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto border border-slate-850">
                  <div className="text-slate-500"># Enable Enterprise OIDC Provider</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_ENABLED</span>=true</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_NAME</span>="Corporate SSO"</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_ISSUER</span>=https://login.microsoftonline.com/&lt;tenant-id&gt;/v2.0</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_CLIENT_ID</span>=00000000-0000-0000-0000-000000000000</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_CLIENT_SECRET</span>=your-client-secret</div>
                  <div className="text-slate-500 mt-2"># Enterprise Group-to-Role Mapping</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_ROLE_CLAIM</span>=groups</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_ADMIN_GROUP</span>=c4-architecture-admins</div>
                  <div><span className="text-cyan-400">AUTH_OIDC_EDITOR_GROUP</span>=c4-architects</div>
                </div>
              </div>

              {/* Group to Role Mapping Card */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-purple-300 block mb-1">Admin Mapping</span>
                  <p className="text-[11px] text-slate-400">
                    Users with the mapped admin group receive CASL <code className="text-purple-300 font-mono">manage: all</code> capabilities.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-blue-300 block mb-1">Editor Mapping</span>
                  <p className="text-[11px] text-slate-400">
                    Architects in the editor group can create, modify, delete elements, and publish versions.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-emerald-300 block mb-1">Default Fallback</span>
                  <p className="text-[11px] text-slate-400">
                    Any corporate employee not in admin/architect groups automatically gets the read-only Viewer role.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
