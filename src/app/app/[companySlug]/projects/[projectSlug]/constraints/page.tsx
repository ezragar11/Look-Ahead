"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, Loader2, CheckCircle2, Clock, Plus, X, Search, ChevronDown, ChevronRight, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Constraint {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  responsibleParty: string | null;
  neededBy: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const TYPES = [
  "RFI", "SUBMITTAL", "MATERIAL", "EQUIPMENT", "ACCESS", "OUTAGE",
  "INSPECTION", "WEATHER", "CREW", "DESIGN", "OWNER", "SAFETY",
  "PERMIT", "ENGINEERING", "LABOR", "OTHER",
];

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  HIGH:   { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30" },
  MEDIUM: { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30" },
  LOW:    { bg: "bg-sky-500/15",    text: "text-sky-300",    border: "border-sky-500/30" },
};

const TYPE_COLORS: Record<string, string> = {
  RFI: "text-blue-400", SUBMITTAL: "text-indigo-400", MATERIAL: "text-amber-400",
  EQUIPMENT: "text-violet-400", ACCESS: "text-orange-400", OUTAGE: "text-red-400",
  INSPECTION: "text-cyan-400", WEATHER: "text-sky-400", CREW: "text-emerald-400",
  DESIGN: "text-fuchsia-400", OWNER: "text-pink-400", SAFETY: "text-yellow-400",
  PERMIT: "text-green-400", ENGINEERING: "text-purple-400", LABOR: "text-teal-400",
  OTHER: "text-slate-400",
};

export default function ConstraintsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  // Deleted history
  const [deletedItems, setDeletedItems] = useState<(Constraint & { deletedAt?: string })[]>([]);
  const [showDeletedHistory, setShowDeletedHistory] = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("MATERIAL");
  const [fPriority, setFPriority] = useState("MEDIUM");
  const [fOwner, setFOwner] = useState("");
  const [fNeededBy, setFNeededBy] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const cRes = await fetch(`/api/constraints?projectId=${proj.id}`);
    if (cRes.ok) setConstraints(await cRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function createConstraint(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    const res = await fetch("/api/constraints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: fTitle,
        type: fType,
        priority: fPriority,
        responsibleParty: fOwner || null,
        neededBy: fNeededBy || null,
        notes: fNotes || null,
      }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to create constraint"); return; }
    toast.success("Constraint created");
    setShowForm(false);
    setFTitle(""); setFType("MATERIAL"); setFPriority("MEDIUM");
    setFOwner(""); setFNeededBy(""); setFNotes("");
    load();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/constraints", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      toast.success(status === "RESOLVED" ? "Constraint resolved" : "Status updated");
      load();
    }
  }

  async function deleteConstraint(id: string) {
    if (!confirm("Delete this constraint?")) return;
    const res = await fetch("/api/constraints", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success("Constraint deleted"); load(); }
    else toast.error("Failed to delete");
  }

  async function loadDeleted() {
    if (!projectId) return;
    const res = await fetch(`/api/constraints?projectId=${projectId}&deleted=only`);
    if (res.ok) setDeletedItems(await res.json());
    setDeletedLoaded(true);
  }

  function toggleDeletedHistory() {
    const next = !showDeletedHistory;
    setShowDeletedHistory(next);
    if (next && !deletedLoaded) loadDeleted();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const today = new Date();
  const filtered = constraints.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.responsibleParty?.toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const open = filtered.filter((c) => c.status !== "RESOLVED");
  const resolved = filtered.filter((c) => c.status === "RESOLVED");
  const totalOpen = constraints.filter((c) => c.status !== "RESOLVED").length;
  const highCount = constraints.filter((c) => c.priority === "HIGH" && c.status !== "RESOLVED").length;
  const overdueCount = constraints.filter((c) => c.status !== "RESOLVED" && c.neededBy && new Date(c.neededBy) < today).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Constraints</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalOpen > 0 ? `${totalOpen} open constraints blocking progress` : "No active constraints"}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Log Constraint
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => { setFilterPriority(""); setFilterType(""); }} className={cn("px-5 py-3 rounded-xl text-left transition-all", !filterPriority && !filterType ? "bg-amber-500/15 border border-amber-500/40" : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600")}>
          <p className="text-amber-300 text-2xl font-black">{totalOpen}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">Open</p>
        </button>
        <button onClick={() => setFilterPriority(filterPriority === "HIGH" ? "" : "HIGH")} className={cn("px-5 py-3 rounded-xl text-left transition-all", filterPriority === "HIGH" ? "bg-red-500/15 border border-red-500/40" : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600")}>
          <p className="text-red-300 text-2xl font-black">{highCount}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">High Priority</p>
        </button>
        <button onClick={() => { /* Just informational */ }} className="px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-left">
          <p className={cn("text-2xl font-black", overdueCount > 0 ? "text-red-400" : "text-emerald-400")}>{overdueCount}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">Overdue</p>
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createConstraint} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Log New Constraint</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="What's blocking progress?" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type *</label>
              <select value={fType} onChange={(e) => setFType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority *</label>
              <select value={fPriority} onChange={(e) => setFPriority(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Responsible Party</label>
              <input value={fOwner} onChange={(e) => setFOwner(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Who needs to resolve?" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Needed By</label>
              <input type="date" value={fNeededBy} onChange={(e) => setFNeededBy(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none" placeholder="Additional context..." />
            </div>
          </div>
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {creating ? "Creating..." : "Create Constraint"}
          </button>
        </form>
      )}

      {/* Search and filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search constraints..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Empty state */}
      {constraints.length === 0 && !showForm && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-yellow-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Constraints Yet</p>
          <p className="text-slate-500 text-sm mt-2">Log constraints that are blocking work progress.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-amber-400 hover:text-amber-300 text-sm font-medium">
            Log your first constraint →
          </button>
        </div>
      )}

      {/* Open constraints */}
      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider px-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Open ({open.length})
          </h2>
          {open.map((c) => {
            const pcfg = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.MEDIUM;
            const overdue = c.neededBy && new Date(c.neededBy) < today;
            const daysOpen = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
            return (
              <div key={c.id} className={cn("rounded-xl border p-5 transition-all", overdue ? "bg-red-500/5 border-red-500/20" : "bg-slate-800/30 border-slate-700/50 hover:border-slate-600")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold">{c.title}</p>
                    {c.notes && <p className="text-slate-400 text-sm mt-1">{c.notes}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <span className={cn("font-semibold", TYPE_COLORS[c.type] ?? "text-slate-400")}>{c.type}</span>
                      {c.responsibleParty && <span className="text-slate-500">Owner: {c.responsibleParty}</span>}
                      <span className="text-slate-600">{daysOpen}d open</span>
                      {c.neededBy && (
                        <span className={cn("flex items-center gap-1", overdue ? "text-red-400 font-bold" : "text-slate-500")}>
                          <Clock className="w-3 h-3" /> Needed by {new Date(c.neededBy).toLocaleDateString()}
                          {overdue && " (OVERDUE)"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", pcfg.bg, pcfg.text, pcfg.border)}>
                      {c.priority}
                    </span>
                    {c.status === "OPEN" && (
                      <button onClick={() => updateStatus(c.id, "IN_PROGRESS")}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all">
                        Start Work
                      </button>
                    )}
                    {c.status === "IN_PROGRESS" && (
                      <button onClick={() => updateStatus(c.id, "RESOLVED")}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-600/30 transition-all">
                        Resolve
                      </button>
                    )}
                    {c.status === "OPEN" && (
                      <button onClick={() => updateStatus(c.id, "RESOLVED")}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-600/30 transition-all">
                        Resolve
                      </button>
                    )}
                    <button onClick={() => deleteConstraint(c.id)}
                      className="px-2 py-1.5 text-[11px] text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved constraints (collapsible) */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <button onClick={() => setShowResolved(!showResolved)} className="text-sm font-bold text-emerald-500 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-emerald-400 transition-colors">
            {showResolved ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <CheckCircle2 className="w-4 h-4" /> Resolved ({resolved.length})
          </button>
          {showResolved && resolved.map((c) => (
            <div key={c.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 font-medium">{c.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className={cn("font-semibold", TYPE_COLORS[c.type] ?? "text-slate-400")}>{c.type}</span>
                    {c.resolvedAt && <span className="text-slate-600">Resolved {new Date(c.resolvedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteConstraint(c.id)}
                    className="px-2 py-1.5 text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
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
                <p className="text-slate-600 text-sm px-1">No deleted constraints.</p>
              )}
              {deletedItems.map((c) => (
                <div key={c.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 font-medium line-through">{c.title}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        <span className={cn("font-semibold", TYPE_COLORS[c.type] ?? "text-slate-400")}>{c.type}</span>
                        <span>{c.priority}</span>
                        {c.responsibleParty && <span>{c.responsibleParty}</span>}
                        {c.deletedAt && <span className="text-red-400/60">Deleted {new Date(c.deletedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
