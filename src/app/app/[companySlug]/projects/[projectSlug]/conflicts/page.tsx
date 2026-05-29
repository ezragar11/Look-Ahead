"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, AlertTriangle, CheckCircle2, Clock, MapPin, Plus, X,
  ChevronDown, RefreshCw, ShieldAlert, Zap, Search, Archive, Trash2,
  Activity, HardHat, Scan, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/* ── Types ── */
interface LinkedActivity {
  activity: {
    id: string;
    activityDescription: string;
    location: string | null;
    subcontractor: { name: string } | null;
  };
}

interface Conflict {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string | null;
  location: string | null;
  conflictType: string;
  owner: string | null;
  neededBy: string | null;
  resolutionNotes: string | null;
  isAutoDetected?: boolean;
  createdAt: string;
  resolvedAt: string | null;
  deletedAt?: string | null;
  conflictActivities?: LinkedActivity[];
}

interface ActivityOption {
  id: string;
  activityDescription: string;
  location: string | null;
  responsibleSubcontractorRaw: string | null;
}

const SEV_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
  CRITICAL: { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30",    label: "Critical", dot: "bg-red-400" },
  HIGH:     { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30", label: "High",     dot: "bg-orange-400" },
  MEDIUM:   { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30",  label: "Medium",   dot: "bg-amber-400" },
  LOW:      { bg: "bg-sky-500/15",    text: "text-sky-300",    border: "border-sky-500/30",    label: "Low",      dot: "bg-sky-400" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  OPEN:            { color: "text-red-400",    label: "Open" },
  UNDER_REVIEW:    { color: "text-amber-400",  label: "Under Review" },
  WAITING_OWNER:   { color: "text-yellow-400", label: "Waiting on Owner" },
  WAITING_SUB:     { color: "text-orange-400", label: "Waiting on Sub" },
  RESOLVED:        { color: "text-emerald-400",label: "Resolved" },
  CLOSED:          { color: "text-slate-400",  label: "Closed" },
};

const CONFLICT_TYPES = [
  "TRADE_OVERLAP", "CREW_AVAILABILITY", "SEQUENCE_ISSUE", "MATERIAL_DELIVERY",
  "PREDECESSOR", "MATERIAL", "OUTAGE", "INSPECTION",
  "SAFETY", "ACCESS", "CREW", "EQUIPMENT", "DESIGN", "WEATHER", "PERMIT",
];

/* ── Page ── */
export default function ConflictsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [search, setSearch]       = useState("");
  const [filterSev, setFilterSev] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  // Deleted history
  const [deletedItems, setDeletedItems] = useState<Conflict[]>([]);
  const [showDeletedHistory, setShowDeletedHistory] = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  // New conflict form
  const [newTitle, setNewTitle]   = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [newSev, setNewSev]       = useState("MEDIUM");
  const [newType, setNewType]     = useState("TRADE_OVERLAP");
  const [newLoc, setNewLoc]       = useState("");
  const [newOwner, setNewOwner]   = useState("");
  const [newNeeded, setNewNeeded] = useState("");

  // Activity picker for form
  const [allActivities, setAllActivities]       = useState<ActivityOption[]>([]);
  const [activitySearch, setActivitySearch]       = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [activitiesLoaded, setActivitiesLoaded]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const cRes = await fetch(`/api/conflicts?projectId=${proj.id}`);
      if (cRes.ok) setConflicts(await cRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  // Load activities when create form opens
  async function loadActivities() {
    if (!projectId || activitiesLoaded) return;
    const res = await fetch(`/api/activities?projectId=${projectId}&limit=500`);
    if (res.ok) {
      const data = await res.json();
      setAllActivities(Array.isArray(data) ? data : data.activities ?? []);
    }
    setActivitiesLoaded(true);
  }

  function openCreateForm() {
    setShowNew(true);
    loadActivities();
  }

  // Filter + search
  const openStatuses = ["OPEN", "UNDER_REVIEW", "WAITING_OWNER", "WAITING_SUB"];
  const open     = conflicts.filter(c => openStatuses.includes(c.status));
  const resolved = conflicts.filter(c => !openStatuses.includes(c.status));

  function filterList(list: Conflict[]) {
    let result = list;
    if (filterSev) result = result.filter(c => c.severity === filterSev);
    if (filterType) result = result.filter(c => c.conflictType === filterType);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.owner?.toLowerCase().includes(q) ||
        c.conflictActivities?.some(ca =>
          ca.activity.activityDescription.toLowerCase().includes(q) ||
          ca.activity.subcontractor?.name.toLowerCase().includes(q)
        )
      );
    }
    return result;
  }

  const filteredOpen = filterList(open);
  const filteredResolved = filterList(resolved);

  // Create conflict
  async function createConflict(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: newTitle, description: newDesc || null,
          severity: newSev, conflictType: newType,
          location: newLoc || null, owner: newOwner || null,
          neededBy: newNeeded || null,
          activityIds: selectedActivityIds.length > 0 ? selectedActivityIds : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Conflict created");
        setShowNew(false);
        setNewTitle(""); setNewDesc(""); setNewLoc(""); setNewOwner(""); setNewNeeded("");
        setSelectedActivityIds([]);
        load();
      } else {
        toast.error("Failed to create conflict");
      }
    } catch { toast.error("Failed"); }
    finally { setCreating(false); }
  }

  // Auto-detect conflicts
  async function runDetection() {
    if (!projectId) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/conflicts/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.conflictsFound > 0) {
          toast.success(`Found ${data.conflictsFound} new conflict${data.conflictsFound > 1 ? "s" : ""}`);
        } else {
          toast.success("No new conflicts detected");
        }
        load();
      } else {
        toast.error("Detection failed");
      }
    } catch { toast.error("Detection failed"); }
    finally { setDetecting(false); }
  }

  // Update status
  async function updateConflictStatus(id: string, newStatus: string) {
    setUpdatingStatus(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/conflicts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setConflicts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
      }
    } catch { /* ignore */ }
    finally { setUpdatingStatus(prev => ({ ...prev, [id]: false })); }
  }

  async function deleteConflict(id: string) {
    if (!confirm("Delete this conflict?")) return;
    try {
      const res = await fetch(`/api/conflicts/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Conflict deleted"); load(); }
      else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
  }

  async function loadDeleted() {
    if (!projectId) return;
    const res = await fetch(`/api/conflicts?projectId=${projectId}&deleted=only`);
    if (res.ok) setDeletedItems(await res.json());
    setDeletedLoaded(true);
  }

  function toggleDeletedHistory() {
    const next = !showDeletedHistory;
    setShowDeletedHistory(next);
    if (next && !deletedLoaded) loadDeleted();
  }

  // Activity picker helpers
  function toggleActivity(id: string) {
    setSelectedActivityIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const filteredActivities = activitySearch
    ? allActivities.filter(a => {
        const q = activitySearch.toLowerCase();
        return a.activityDescription.toLowerCase().includes(q) ||
               a.location?.toLowerCase().includes(q) ||
               a.responsibleSubcontractorRaw?.toLowerCase().includes(q);
      })
    : allActivities.slice(0, 20);

  // Stats
  const bySeverity: Record<string, number> = {};
  open.forEach(c => { bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1; });
  const autoCount = open.filter(c => c.isAutoDetected).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* ═══════ Header ═══════ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Conflicts</h1>
          <p className="text-slate-500 text-sm mt-1">
            {open.length > 0 ? `${open.length} open, ${resolved.length} resolved` : "No active conflicts"}
            {autoCount > 0 && <span className="text-violet-400 ml-1">({autoCount} auto-detected)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runDetection} disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 text-violet-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            {detecting ? "Scanning..." : "Detect Conflicts"}
          </button>
          <button onClick={load} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" /> Log Conflict
          </button>
        </div>
      </div>

      {/* ═══════ Severity Summary ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(sev => {
          const cfg = SEV_CONFIG[sev];
          const count = bySeverity[sev] ?? 0;
          const active = filterSev === sev;
          return (
            <button key={sev} onClick={() => setFilterSev(active ? null : sev)}
              className={cn(
                "rounded-xl border p-4 text-center transition-all",
                active ? cn(cfg.bg, cfg.border, "ring-1 ring-offset-0 ring-current/30")
                : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
              )}
            >
              <p className={cn("text-2xl font-black", count > 0 ? cfg.text : "text-slate-600")}>{count}</p>
              <p className={cn("text-[10px] font-bold uppercase tracking-wider", count > 0 ? cfg.text : "text-slate-600", "opacity-70")}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* ═══════ Search + Filters ═══════ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conflicts, activities, subs..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <select
          value={filterType ?? ""}
          onChange={e => setFilterType(e.target.value || null)}
          className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-sky-500/50 appearance-none"
        >
          <option value="">All Types</option>
          {CONFLICT_TYPES.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        {(filterSev || filterType || search) && (
          <button onClick={() => { setFilterSev(null); setFilterType(null); setSearch(""); }}
            className="text-sky-400 text-xs font-medium hover:text-sky-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ═══════ New Conflict Form ═══════ */}
      {showNew && (
        <form onSubmit={createConflict} className="bg-slate-800/50 rounded-2xl border border-orange-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" /> Log New Conflict
            </h3>
            <button type="button" onClick={() => { setShowNew(false); setSelectedActivityIds([]); }} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                placeholder="e.g., JWD and Mascaro overlap at west gate" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500/50"
                placeholder="Describe the conflict..." />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Severity</label>
              <select value={newSev} onChange={e => setNewSev(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none appearance-none">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Conflict Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none appearance-none">
                {CONFLICT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input value={newLoc} onChange={e => setNewLoc(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                placeholder="e.g., West Gate" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Owner / Responsible</label>
              <input value={newOwner} onChange={e => setNewOwner(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                placeholder="e.g., PM, Superintendent" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Needed By</label>
              <input type="date" value={newNeeded} onChange={e => setNewNeeded(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          </div>

          {/* ── Activity Picker ── */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Link Activities
              {selectedActivityIds.length > 0 && <span className="text-sky-400 ml-1">({selectedActivityIds.length} selected)</span>}
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input
                value={activitySearch} onChange={e => setActivitySearch(e.target.value)}
                placeholder="Search activities by name, location, or sub..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50" />
            </div>

            {/* Selected pills */}
            {selectedActivityIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedActivityIds.map(id => {
                  const act = allActivities.find(a => a.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-sky-500/15 border border-sky-500/25 rounded-lg text-[11px] text-sky-300">
                      {act?.activityDescription.slice(0, 40) ?? id}
                      <button type="button" onClick={() => toggleActivity(id)} className="hover:text-white"><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Activity list */}
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-700/50 bg-slate-900/30 p-2">
              {!activitiesLoaded && <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 text-slate-600 animate-spin" /></div>}
              {activitiesLoaded && filteredActivities.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-2">{activitySearch ? "No matching activities" : "No activities found"}</p>
              )}
              {filteredActivities.map(a => {
                const selected = selectedActivityIds.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleActivity(a.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2",
                      selected ? "bg-sky-500/15 border border-sky-500/25 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
                    )}>
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                      selected ? "bg-sky-500 border-sky-500" : "border-slate-600")}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1 truncate">{a.activityDescription}</span>
                    {a.location && <span className="text-slate-600 text-[10px] flex-shrink-0">{a.location}</span>}
                    {a.responsibleSubcontractorRaw && (
                      <span className="text-violet-400/60 text-[10px] flex-shrink-0">{a.responsibleSubcontractorRaw}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          >
            {creating ? "Creating..." : "Create Conflict"}
          </button>
        </form>
      )}

      {/* ═══════ Open Conflicts ═══════ */}
      {filteredOpen.length === 0 && filteredResolved.length === 0 && conflicts.length === 0 && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-orange-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Conflicts Logged</p>
          <p className="text-slate-500 text-sm mt-2">Log conflicts manually, or click <strong>Detect Conflicts</strong> to auto-scan for scheduling overlaps.</p>
        </div>
      )}

      {filteredOpen.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider px-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Open ({filteredOpen.length})
          </h2>
          {filteredOpen.map((c) => {
            const cfg = SEV_CONFIG[c.severity] ?? SEV_CONFIG.MEDIUM;
            const stCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.OPEN;
            const isUpdating = updatingStatus[c.id];
            const daysOpen = Math.max(1, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000));
            const overdue = c.neededBy && new Date(c.neededBy) < new Date();
            const linked = c.conflictActivities ?? [];

            return (
              <div key={c.id} className={cn("rounded-2xl border p-5 transition-all hover:border-slate-600", cfg.bg, cfg.border)}>
                <div className="flex items-start gap-4">
                  {/* Severity indicator */}
                  <div className={cn("w-2 rounded-full self-stretch flex-shrink-0", cfg.dot)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-white font-bold">{c.title}</p>
                        {c.description && <p className="text-slate-400 text-sm mt-1">{c.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.isAutoDetected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">
                            Auto
                          </span>
                        )}
                        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cfg.bg, cfg.text, cfg.border)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <span className="text-slate-500 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> {c.conflictType.replace(/_/g, " ")}
                      </span>
                      {c.location && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {c.location}
                        </span>
                      )}
                      {c.owner && <span className="text-slate-500">Owner: {c.owner}</span>}
                      <span className="text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {daysOpen}d open
                      </span>
                      {c.neededBy && (
                        <span className={cn("flex items-center gap-1", overdue ? "text-red-400 font-bold" : "text-slate-500")}>
                          {overdue ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          Need by {new Date(c.neededBy).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {overdue && " (overdue)"}
                        </span>
                      )}
                    </div>

                    {/* ── Linked Activities ── */}
                    {linked.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/20">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Linked Activities ({linked.length})
                        </p>
                        <div className="space-y-1">
                          {linked.map(({ activity: a }) => (
                            <div key={a.id} className="flex items-center gap-2 text-xs bg-slate-800/40 rounded-lg px-3 py-1.5">
                              <span className="text-white flex-1 truncate">{a.activityDescription}</span>
                              {a.location && (
                                <span className="text-slate-500 flex items-center gap-1 flex-shrink-0">
                                  <MapPin className="w-2.5 h-2.5" /> {a.location}
                                </span>
                              )}
                              {a.subcontractor && (
                                <span className="text-violet-400/70 flex items-center gap-1 flex-shrink-0">
                                  <HardHat className="w-2.5 h-2.5" /> {a.subcontractor.name}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status + actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/30">
                      <span className={cn("text-xs font-bold", stCfg.color)}>{stCfg.label}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {c.status === "OPEN" && (
                          <button onClick={() => updateConflictStatus(c.id, "UNDER_REVIEW")} disabled={isUpdating}
                            className="text-[11px] px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                            Start Review
                          </button>
                        )}
                        {(c.status === "OPEN" || c.status === "UNDER_REVIEW" || c.status === "WAITING_OWNER" || c.status === "WAITING_SUB") && (
                          <button onClick={() => updateConflictStatus(c.id, "RESOLVED")} disabled={isUpdating}
                            className="text-[11px] px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                            Resolve
                          </button>
                        )}
                        <button onClick={() => deleteConflict(c.id)}
                          className="text-[11px] px-2 py-1 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ Resolved ═══════ */}
      {filteredResolved.length > 0 && (
        <div className="space-y-3">
          <button onClick={() => setShowResolved(!showResolved)}
            className="text-sm font-bold text-emerald-500 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-emerald-400 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Resolved ({filteredResolved.length})
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showResolved && "rotate-180")} />
          </button>
          {showResolved && filteredResolved.map((c) => (
            <div key={c.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-60 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-slate-300 font-medium">{c.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                    <span>{c.conflictType.replace(/_/g, " ")}</span>
                    {c.location && <span>{c.location}</span>}
                    {c.resolutionNotes && <span>Resolution: {c.resolutionNotes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteConflict(c.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-emerald-500/60 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                    {c.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ Deleted History ═══════ */}
      {projectId && (
        <div className="pt-2">
          <button onClick={toggleDeletedHistory}
            className="text-sm font-bold text-slate-600 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-slate-400 transition-colors">
            <Archive className="w-4 h-4" /> Deleted History
            {deletedLoaded && <span className="text-xs font-normal">({deletedItems.length})</span>}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDeletedHistory && "rotate-180")} />
          </button>
          {showDeletedHistory && (
            <div className="mt-3 space-y-2">
              {!deletedLoaded && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-slate-600 animate-spin" /></div>}
              {deletedLoaded && deletedItems.length === 0 && (
                <p className="text-slate-600 text-sm px-1">No deleted conflicts.</p>
              )}
              {deletedItems.map((c) => {
                const cfg = SEV_CONFIG[c.severity] ?? SEV_CONFIG.MEDIUM;
                return (
                  <div key={c.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 font-medium line-through">{c.title}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                          <span className={cfg.text}>{cfg.label}</span>
                          <span>{c.conflictType.replace(/_/g, " ")}</span>
                          {c.location && <span>{c.location}</span>}
                          {c.deletedAt && <span className="text-red-400/60">Deleted {new Date(c.deletedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
