"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Loader2, UserPlus, Mail, Clock, Search, X,
  Shield, ChevronDown, FolderOpen, MoreVertical, UserMinus,
  Lock, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/* ── Types ── */

interface ProjectAssignment {
  role: string;
  project: { id: string; projectName: string; slug: string | null; status: string };
}

interface CompanyMember {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    globalRole: string;
    lastLoginAt: string | null;
    phone: string | null;
    status: string;
    projectUsers: ProjectAssignment[];
  };
}

interface UserResult {
  id: string;
  name: string;
  email: string;
  globalRole: string;
}

const COMPANY_ROLES = [
  { value: "COMPANY_ADMIN",       label: "Company Admin",    color: "text-violet-300",  bg: "bg-violet-500/15", border: "border-violet-500/30" },
  { value: "EXECUTIVE_VIEWER",    label: "Executive",        color: "text-sky-300",     bg: "bg-sky-500/15",    border: "border-sky-500/30" },
  { value: "OPERATIONS_MANAGER",  label: "Ops Manager",      color: "text-amber-300",   bg: "bg-amber-500/15",  border: "border-amber-500/30" },
  { value: "PROJECT_MANAGER",     label: "PM",               color: "text-emerald-300", bg: "bg-emerald-500/15",border: "border-emerald-500/30" },
  { value: "SUPERINTENDENT",      label: "Super",            color: "text-cyan-300",    bg: "bg-cyan-500/15",   border: "border-cyan-500/30" },
  { value: "ENGINEER",            label: "Engineer",         color: "text-green-300",   bg: "bg-green-500/15",  border: "border-green-500/30" },
  { value: "FIELD_ASSISTANT",     label: "Field",            color: "text-teal-300",    bg: "bg-teal-500/15",   border: "border-teal-500/30" },
  { value: "CLIENT_VIEWER",       label: "Client",           color: "text-slate-300",   bg: "bg-slate-500/15",  border: "border-slate-500/30" },
  { value: "SUBCONTRACTOR",       label: "Subcontractor",    color: "text-orange-300",  bg: "bg-orange-500/15", border: "border-orange-500/30" },
];

function getRoleCfg(role: string) {
  return COMPANY_ROLES.find(r => r.value === role) ?? { value: role, label: role, color: "text-slate-300", bg: "bg-slate-500/15", border: "border-slate-500/30" };
}

const AVATAR_GRADIENTS = [
  "from-sky-500 to-violet-600", "from-emerald-500 to-cyan-600",
  "from-amber-500 to-orange-600", "from-fuchsia-500 to-pink-600",
  "from-red-500 to-orange-600", "from-indigo-500 to-sky-600",
];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

/* ── Page ── */

export default function CompanyUsersPage() {
  const { companySlug } = useParams<{ companySlug: string }>();

  const [members, setMembers]   = useState<CompanyMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("");
  const [filterRole, setFilterRole] = useState("");

  // Invite
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteTab, setInviteTab]     = useState<"search" | "create">("search");
  const [searchQ, setSearchQ]         = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [inviteRole, setInviteRole]   = useState("ENGINEER");
  const [adding, setAdding]           = useState(false);

  // Create new user
  const [newName, setNewName]       = useState("");
  const [newEmail, setNewEmail]     = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone]     = useState("");

  // Expand
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // ── Load ──

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/users`);
      if (res.ok) setMembers(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug]);

  useEffect(() => { load(); }, [load]);

  // ── User search ──

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // ── Actions ──

  async function addUser(userId: string) {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: inviteRole }),
      });
      if (res.ok) {
        toast.success("User added to company");
        setSearchQ(""); setSearchResults([]);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed");
      }
    } catch { toast.error("Failed"); }
    finally { setAdding(false); }
  }

  async function createAndAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      // 1. Create user account
      const uRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName, email: newEmail, password: newPassword,
          phone: newPhone || undefined,
        }),
      });
      if (!uRes.ok) {
        const err = await uRes.json();
        toast.error(err.error ?? "Failed to create user");
        setAdding(false);
        return;
      }
      const newUser = await uRes.json();

      // 2. Add to company
      const cRes = await fetch(`/api/companies/${companySlug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newUser.id, role: inviteRole }),
      });

      if (cRes.ok) {
        toast.success(`Created account for ${newName} and added to company`);
        setNewName(""); setNewEmail(""); setNewPassword(""); setNewPhone("");
        setInviteTab("search");
        load();
      } else {
        toast.error("User created but failed to add to company");
      }
    } catch { toast.error("Failed"); }
    finally { setAdding(false); }
  }

  async function changeRole(memberId: string, role: string) {
    try {
      const res = await fetch(`/api/companies/${companySlug}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, role }),
      });
      if (res.ok) { toast.success("Role updated"); setEditingRole(null); load(); }
      else toast.error("Failed");
    } catch { toast.error("Failed"); }
  }

  async function suspendUser(m: CompanyMember) {
    const newStatus = m.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (newStatus === "SUSPENDED" && !confirm(`Suspend ${m.user.name}?`)) return;
    try {
      const res = await fetch(`/api/companies/${companySlug}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, status: newStatus }),
      });
      if (res.ok) { toast.success(newStatus === "ACTIVE" ? "Reactivated" : "Suspended"); load(); }
      else toast.error("Failed");
    } catch { toast.error("Failed"); }
  }

  // ── Derived ──

  const activeMembers = members.filter(m => m.status !== "REMOVED");
  const existingUserIds = new Set(members.map(m => m.user.id));
  const filteredMembers = activeMembers.filter(m => {
    if (filterRole && m.role !== filterRole) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
    }
    return true;
  });

  const roleCounts: Record<string, number> = {};
  activeMembers.forEach(m => { roleCounts[m.role] = (roleCounts[m.role] || 0) + 1; });

  // ── Render ──

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Users</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeMembers.length} user{activeMembers.length !== 1 ? "s" : ""} in the organization
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/20">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Summary chips */}
      {activeMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterRole("")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              !filterRole ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-white")}>
            All ({activeMembers.length})
          </button>
          {COMPANY_ROLES.filter(r => roleCounts[r.value]).map(r => (
            <button key={r.value} onClick={() => setFilterRole(filterRole === r.value ? "" : r.value)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                filterRole === r.value ? cn(r.bg, r.color, r.border) : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-white")}>
              {r.label} ({roleCounts[r.value]})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {activeMembers.length > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter users..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500" />
        </div>
      )}

      {/* Invite panel */}
      {showInvite && (
        <div className="bg-slate-800/50 rounded-2xl border border-violet-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-violet-400" /> Add User to Company
            </h3>
            <button onClick={() => { setShowInvite(false); setSearchQ(""); setSearchResults([]); setInviteTab("search"); }}
              className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1">
            <button onClick={() => setInviteTab("search")}
              className={cn("flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                inviteTab === "search" ? "bg-violet-500/20 text-violet-300" : "text-slate-500 hover:text-white")}>
              <Search className="w-3 h-3 inline mr-1.5" />Search Existing User
            </button>
            <button onClick={() => setInviteTab("create")}
              className={cn("flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                inviteTab === "create" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-500 hover:text-white")}>
              <UserPlus className="w-3 h-3 inline mr-1.5" />Create New Account
            </button>
          </div>

          {inviteTab === "search" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <label className="block text-xs text-slate-400 mb-1">Search by name or email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    placeholder="Type at least 2 characters..."
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-40 max-h-48 overflow-y-auto">
                    {searchResults.map(u => {
                      const alreadyAdded = existingUserIds.has(u.id);
                      return (
                        <button key={u.id} disabled={alreadyAdded || adding}
                          onClick={() => addUser(u.id)}
                          className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-700/50")}>
                          <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                            AVATAR_GRADIENTS[u.name.charCodeAt(0) % AVATAR_GRADIENTS.length])}>
                            <span className="text-white text-xs font-bold">{getInitials(u.name)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate">{u.name}</p>
                            <p className="text-slate-500 text-xs truncate">{u.email}</p>
                          </div>
                          {alreadyAdded ? <span className="text-xs text-slate-500">Already added</span> : <UserPlus className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-center z-40">
                    <p className="text-slate-500 text-sm">No users found matching &quot;{searchQ}&quot;</p>
                    <button onClick={() => setInviteTab("create")}
                      className="text-violet-400 text-xs mt-2 hover:underline">Create a new account instead</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Company Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 appearance-none">
                  {COMPANY_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <form onSubmit={createAndAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={newName} onChange={e => setNewName(e.target.value)} required
                      placeholder="John Smith"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email"
                      placeholder="john@company.com"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Temp Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                      minLength={6} placeholder="Min 6 characters"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Company Role</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 appearance-none">
                    {COMPANY_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={adding}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {adding ? "Creating..." : "Create Account & Add to Company"}
                </button>
                <p className="text-slate-600 text-[10px]">Creates a login they can use immediately.</p>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Empty */}
      {activeMembers.length === 0 && !showInvite && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">No Users</p>
          <p className="text-slate-500 text-sm mt-2">Add users to the company to manage access.</p>
        </div>
      )}

      {/* Users table */}
      {filteredMembers.length > 0 && (
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                <th className="px-5 py-3 text-left">User</th>
                <th className="px-5 py-3 text-left">Company Role</th>
                <th className="px-5 py-3 text-left">Projects</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Last Seen</th>
                <th className="px-5 py-3 text-right w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredMembers.map(m => {
                const rc = getRoleCfg(m.role);
                const initials = getInitials(m.user.name);
                const gradientIdx = m.user.name.charCodeAt(0) % AVATAR_GRADIENTS.length;
                const isExpanded = expanded === m.id;
                const isEditingRole = editingRole === m.id;

                return (
                  <tr key={m.id}
                    className={cn("hover:bg-slate-700/20 transition-colors",
                      m.status === "SUSPENDED" && "opacity-50")}>
                    {/* User */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", AVATAR_GRADIENTS[gradientIdx])}>
                          <span className="text-white text-sm font-bold">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{m.user.name}</p>
                          <p className="text-slate-500 text-xs truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3">
                      {isEditingRole ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <select
                            defaultValue={m.role}
                            onChange={e => changeRole(m.id, e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            {COMPANY_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <button onClick={() => setEditingRole(null)} className="text-slate-500 hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", rc.bg, rc.color, rc.border)}>
                          {rc.label}
                        </span>
                      )}
                    </td>

                    {/* Projects */}
                    <td className="px-5 py-3">
                      {m.user.projectUsers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {m.user.projectUsers.slice(0, 3).map(pu => (
                            <Link key={pu.project.id}
                              href={`/app/${companySlug}/projects/${pu.project.slug ?? pu.project.id}`}
                              className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-full hover:bg-sky-500/20 truncate max-w-[120px]">
                              {pu.project.projectName}
                            </Link>
                          ))}
                          {m.user.projectUsers.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{m.user.projectUsers.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">No projects</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        m.status === "ACTIVE" ? "text-emerald-300 bg-emerald-500/15" :
                        m.status === "SUSPENDED" ? "text-red-300 bg-red-500/15" :
                        "text-slate-300 bg-slate-500/15"
                      )}>{m.status}</span>
                    </td>

                    {/* Last Seen */}
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {m.user.lastLoginAt
                        ? new Date(m.user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right relative">
                      <button onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === m.id && (
                        <div className="absolute right-5 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-40 py-1 w-44">
                          <button onClick={() => { setEditingRole(m.id); setMenuOpen(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" /> Change Role
                          </button>
                          <button onClick={() => { suspendUser(m); setMenuOpen(null); }}
                            className={cn("w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                              m.status === "SUSPENDED" ? "text-emerald-400 hover:bg-emerald-500/10" : "text-red-400 hover:bg-red-500/10")}>
                            <UserMinus className="w-3.5 h-3.5" />
                            {m.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
