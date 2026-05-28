"use client";

import { useEffect, useState } from "react";
import {
  Users, UserPlus, RefreshCw, Shield, CheckCircle,
  XCircle, Clock, Eye, EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { ROLE_LABELS } from "@/lib/auth";
import { ROLE_CAPABILITIES } from "@/lib/permissions";
import type { UserRole } from "@/lib/auth";

interface User {
  id:         string;
  name:       string;
  email:      string;
  company:    string | null;
  globalRole: string;
  status:     string;
  lastLoginAt: string | null;
  createdAt:  string;
  _count:     { projectUsers: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:    { label: "Active",    color: "text-green-700 bg-green-50 border-green-200",   icon: <CheckCircle className="w-3.5 h-3.5" /> },
  SUSPENDED: { label: "Suspended", color: "text-red-600 bg-red-50 border-red-200",         icon: <XCircle className="w-3.5 h-3.5" /> },
  INVITED:   { label: "Invited",   color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: <Clock className="w-3.5 h-3.5" /> },
};

const ROLES: UserRole[] = [
  "ADMIN","PROJECT_MANAGER","SUPERINTENDENT","ENGINEER","INTERN","SUBCONTRACTOR","OWNER_CLIENT",
];

const emptyForm = {
  name: "", email: "", password: "", globalRole: "ENGINEER" as UserRole, company: "",
};

export default function UsersPage() {
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [hoverRole, setHoverRole] = useState<UserRole | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }

  async function saveUser() {
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email, and password are required"); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      toast.success("User created");
      setForm(emptyForm);
      setShowForm(false);
      await fetchUsers();
    } catch { toast.error("Failed to create user"); }
    finally { setSaving(false); }
  }

  async function toggleStatus(user: User) {
    const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await fetch("/api/users", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: user.id, status: newStatus }),
      });
      toast.success(`User ${newStatus === "ACTIVE" ? "activated" : "suspended"}`);
      await fetchUsers();
    } catch { toast.error("Update failed"); }
  }

  async function changeRole(user: User, globalRole: string) {
    try {
      await fetch("/api/users", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: user.id, globalRole }),
      });
      toast.success("Role updated");
      await fetchUsers();
    } catch { toast.error("Update failed"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{users.length} user{users.length !== 1 ? "s" : ""} · Admin-only access</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Role guide */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Role Permissions — hover a role to see capabilities</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <div key={role} className="relative">
              <span
                onMouseEnter={() => setHoverRole(role)}
                onMouseLeave={() => setHoverRole(null)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-default"
              >
                {ROLE_LABELS[role]}
              </span>
              {hoverRole === role && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-slate-800 text-white rounded-lg shadow-xl p-3 z-50 text-xs">
                  <p className="font-semibold mb-1.5">{ROLE_LABELS[role]}</p>
                  <ul className="space-y-0.5 text-slate-300">
                    {ROLE_CAPABILITIES[role].map((cap) => (
                      <li key={cap} className="flex gap-1">
                        <span className="text-blue-400 flex-shrink-0">·</span>
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add user form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Create New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name*"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email address*"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Password (min 8 chars)*"
                className="w-full border border-gray-200 rounded-lg px-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <select value={form.globalRole} onChange={(e) => setForm((f) => ({ ...f, globalRole: e.target.value as UserRole }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <input type="text" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Company (optional)"
              className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveUser} disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
              {saving ? "Creating…" : "Create User"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Email</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Last Login</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2.5 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const stat = STATUS_CONFIG[user.status] ?? STATUS_CONFIG["ACTIVE"];
                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{user.name}</div>
                      {user.company && <div className="text-xs text-gray-400">{user.company}</div>}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{user.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={user.globalRole}
                        onChange={(e) => changeRole(user, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium border ${stat.color}`}>
                        {stat.icon}{stat.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(user)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                          user.status === "ACTIVE"
                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                            : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        }`}
                      >
                        {user.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No users yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
