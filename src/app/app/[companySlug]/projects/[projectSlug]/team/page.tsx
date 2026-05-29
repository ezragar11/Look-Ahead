"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Users, Loader2, UserPlus, Mail, Clock, Search, X,
  Shield, ChevronDown, Trash2, Check, MoreVertical,
  Activity, AlertTriangle, UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/* ── Types ── */

interface TeamMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  removedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    globalRole: string;
    lastLoginAt: string | null;
    phone: string | null;
  };
}

interface UserResult {
  id: string;
  name: string;
  email: string;
  globalRole: string;
}

const PROJECT_ROLES = [
  { value: "PROJECT_ADMIN",   label: "Project Admin",    color: "text-violet-300",  bg: "bg-violet-500/15", border: "border-violet-500/30" },
  { value: "PROJECT_MANAGER", label: "Project Manager",  color: "text-sky-300",     bg: "bg-sky-500/15",    border: "border-sky-500/30" },
  { value: "SUPERINTENDENT",  label: "Superintendent",   color: "text-amber-300",   bg: "bg-amber-500/15",  border: "border-amber-500/30" },
  { value: "ENGINEER",        label: "Engineer",         color: "text-emerald-300", bg: "bg-emerald-500/15",border: "border-emerald-500/30" },
  { value: "FIELD_ASSISTANT", label: "Field Assistant",  color: "text-cyan-300",    bg: "bg-cyan-500/15",   border: "border-cyan-500/30" },
  { value: "SUBCONTRACTOR",   label: "Subcontractor",    color: "text-orange-300",  bg: "bg-orange-500/15", border: "border-orange-500/30" },
  { value: "OWNER_VIEWER",    label: "Owner / Viewer",   color: "text-slate-300",   bg: "bg-slate-500/15",  border: "border-slate-500/30" },
];

function getRoleCfg(role: string) {
  return PROJECT_ROLES.find(r => r.value === role) ?? PROJECT_ROLES[3];
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

export default function TeamPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();

  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  // Invite
  const [showInvite, setShowInvite]   = useState(false);
  const [searchQ, setSearchQ]         = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [inviteRole, setInviteRole]   = useState("ENGINEER");
  const [adding, setAdding]           = useState(false);

  // Edit role
  const [editingRole, setEditingRole]   = useState<string | null>(null);
  const [menuOpen, setMenuOpen]         = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState("");

  // ── Load ──

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const mRes = await fetch(`/api/project-users?projectId=${proj.id}`);
      if (mRes.ok) setMembers(await mRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  // ── User search for invite ──

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

  async function addMember(userId: string) {
    if (!projectId || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/project-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId, role: inviteRole }),
      });
      if (res.ok) {
        toast.success("Member added");
        setSearchQ(""); setSearchResults([]);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed");
      }
    } catch { toast.error("Failed"); }
    finally { setAdding(false); }
  }

  async function changeRole(memberId: string, role: string) {
    try {
      const res = await fetch("/api/project-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, role }),
      });
      if (res.ok) {
        toast.success("Role updated");
        setEditingRole(null);
        load();
      } else toast.error("Failed");
    } catch { toast.error("Failed"); }
  }

  async function removeMember(m: TeamMember) {
    if (!confirm(`Remove ${m.user.name} from this project?`)) return;
    try {
      const res = await fetch("/api/project-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id }),
      });
      if (res.ok) { toast.success("Removed"); load(); }
      else toast.error("Failed");
    } catch { toast.error("Failed"); }
  }

  // ── Derived ──

  const activeMembers = members.filter(m => m.status !== "REMOVED");
  const existingUserIds = new Set(members.map(m => m.user.id));
  const filteredMembers = activeMembers.filter(m => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.user.name.toLowerCase().includes(q)
      || m.user.email.toLowerCase().includes(q)
      || m.role.toLowerCase().includes(q);
  });

  // ── Render ──

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project Team</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20">
          <UserPlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Role summary chips */}
      {activeMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {PROJECT_ROLES.map(r => {
            const count = activeMembers.filter(m => m.role === r.value).length;
            if (!count) return null;
            return (
              <span key={r.value} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border", r.bg, r.color, r.border)}>
                {r.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Search / filter */}
      {activeMembers.length > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter team..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500" />
        </div>
      )}

      {/* Invite panel */}
      {showInvite && (
        <div className="bg-slate-800/50 rounded-2xl border border-emerald-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" /> Add Team Member
            </h3>
            <button onClick={() => { setShowInvite(false); setSearchQ(""); setSearchResults([]); }}
              className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* User search */}
            <div className="md:col-span-2 relative">
              <label className="block text-xs text-slate-400 mb-1">Search by name or email</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Type at least 2 characters..."
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-40 max-h-48 overflow-y-auto">
                  {searchResults.map(u => {
                    const alreadyAdded = existingUserIds.has(u.id);
                    return (
                      <button key={u.id} disabled={alreadyAdded || adding}
                        onClick={() => addMember(u.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          alreadyAdded
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-slate-700/50"
                        )}>
                        <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                          AVATAR_GRADIENTS[u.name.charCodeAt(0) % AVATAR_GRADIENTS.length])}>
                          <span className="text-white text-xs font-bold">{getInitials(u.name)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{u.name}</p>
                          <p className="text-slate-500 text-xs truncate">{u.email}</p>
                        </div>
                        {alreadyAdded ? (
                          <span className="text-xs text-slate-500">Already added</span>
                        ) : (
                          <UserPlus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-center z-40">
                  <p className="text-slate-500 text-sm">No users found matching &quot;{searchQ}&quot;</p>
                  <p className="text-slate-600 text-xs mt-1">They need to have an account first.</p>
                </div>
              )}
            </div>

            {/* Role picker */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Assign Role</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 appearance-none">
                {PROJECT_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeMembers.length === 0 && !showInvite && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-emerald-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Team Members</p>
          <p className="text-slate-500 text-sm mt-2">Add team members to collaborate on this project.</p>
          <button onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-sm font-semibold transition-all">
            <UserPlus className="w-4 h-4" /> Add First Member
          </button>
        </div>
      )}

      {/* Members grid */}
      {filteredMembers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map(m => {
            const rc = getRoleCfg(m.role);
            const initials = getInitials(m.user.name);
            const gradientIdx = m.user.name.charCodeAt(0) % AVATAR_GRADIENTS.length;
            const isEditingRole = editingRole === m.id;

            return (
              <div key={m.id} className="bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all p-5 group relative">
                {/* Menu button */}
                <div className="absolute top-3 right-3">
                  <button onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-700/50 transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === m.id && (
                    <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 z-40 py-1 w-44">
                      <button onClick={() => { setEditingRole(m.id); setMenuOpen(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" /> Change Role
                      </button>
                      <button onClick={() => { removeMember(m); setMenuOpen(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar + info */}
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", AVATAR_GRADIENTS[gradientIdx])}>
                    <span className="text-white text-lg font-bold">{initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{m.user.name}</p>
                    <p className="text-slate-500 text-xs truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {m.user.email}
                    </p>
                  </div>
                </div>

                {/* Role + status */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {isEditingRole ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {PROJECT_ROLES.map(r => (
                        <button key={r.value} onClick={() => changeRole(m.id, r.value)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full border transition-all",
                            m.role === r.value
                              ? cn(r.bg, r.color, r.border, "ring-1 ring-white/30")
                              : "bg-slate-800 text-slate-500 border-slate-700 hover:text-white hover:border-slate-500"
                          )}>
                          {r.label}
                        </button>
                      ))}
                      <button onClick={() => setEditingRole(null)} className="text-slate-500 hover:text-white ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", rc.bg, rc.color, rc.border)}>
                        {rc.label}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full",
                        m.status === "ACTIVE" ? "text-emerald-300 bg-emerald-500/15" :
                        m.status === "INVITED" ? "text-amber-300 bg-amber-500/15" :
                        m.status === "SUSPENDED" ? "text-red-300 bg-red-500/15" :
                        "text-slate-300 bg-slate-500/15"
                      )}>{m.status}</span>
                    </>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </span>
                  {m.user.lastLoginAt && (
                    <span>Last seen {new Date(m.user.lastLoginAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
