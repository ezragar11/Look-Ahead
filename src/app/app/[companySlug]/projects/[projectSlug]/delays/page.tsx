"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Timer, Loader2, TrendingDown, AlertTriangle, Plus, X, Search, CheckCircle2, ChevronDown, ChevronRight, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Delay {
  id: string;
  title: string;
  delayType: string;
  status: string;
  daysDelayed: number | null;
  cause: string | null;
  responsibleParty: string | null;
  impact: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  activity?: { id: string; activityDescription: string; location: string | null } | null;
  subcontractor?: { id: string; name: string } | null;
}

const DELAY_TYPES = [
  "WEATHER", "MATERIAL", "MANPOWER", "DESIGN", "RFI", "ACCESS",
  "INSPECTION", "OUTAGE", "SAFETY", "EQUIPMENT", "OWNER", "UTILITY", "OTHER",
];

const STATUSES = ["OPEN", "MONITORING", "RESOLVED"];

const TYPE_COLORS: Record<string, string> = {
  WEATHER: "text-sky-400", MATERIAL: "text-amber-400", MANPOWER: "text-violet-400",
  DESIGN: "text-fuchsia-400", RFI: "text-blue-400", ACCESS: "text-orange-400",
  INSPECTION: "text-cyan-400", OUTAGE: "text-red-400", SAFETY: "text-yellow-400",
  EQUIPMENT: "text-emerald-400", OWNER: "text-pink-400", UTILITY: "text-teal-400",
  OTHER: "text-slate-400",
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  OPEN:       { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30" },
  MONITORING: { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30" },
  RESOLVED:   { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
};

export default function DelaysPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [delays, setDelays] = useState<Delay[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  // Deleted history
  const [deletedItems, setDeletedItems] = useState<(Delay & { deletedAt?: string })[]>([]);
  const [showDeletedHistory, setShowDeletedHistory] = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("MATERIAL");
  const [fCause, setFCause] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fImpact, setFImpact] = useState("");
  const [fDays, setFDays] = useState("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const dRes = await fetch(`/api/delays?projectId=${proj.id}`);
    if (dRes.ok) setDelays(await dRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function createDelay(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    const res = await fetch("/api/delays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: fTitle,
        delayType: fType,
        cause: fCause || null,
        responsibleParty: fOwner || null,
        impact: fImpact || null,
        daysDelayed: fDays ? parseInt(fDays) : null,
        startDate: fStart || null,
        endDate: fEnd || null,
        notes: fNotes || null,
      }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to log delay"); return; }
    toast.success("Delay logged");
    setShowForm(false);
    setFTitle(""); setFType("MATERIAL"); setFCause(""); setFOwner("");
    setFImpact(""); setFDays(""); setFStart(""); setFEnd(""); setFNotes("");
    load();
  }

  async function updateStatus(id: string, status: string) {
    const prev = delays;
    setDelays(ds => ds.map(d => d.id === id ? { ...d, status } : d));
    toast.success(status === "RESOLVED" ? "Delay resolved" : "Status updated");
    const res = await fetch("/api/delays", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) { setDelays(prev); toast.error("Failed to update — reverted"); }
  }

  function deleteDelay(id: string) {
    const prev = delays;
    setDelays(ds => ds.filter(d => d.id !== id));
    let cancelled = false;
    const tid = setTimeout(async () => {
      if (cancelled) return;
      const res = await fetch("/api/delays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { setDelays(prev); toast.error("Delete failed — reverted"); }
    }, 4000);
    toast((t) => (
      <span className="flex items-center gap-3">
        Delay deleted
        <button className="font-bold text-sky-500 hover:text-sky-400" onClick={() => { cancelled = true; clearTimeout(tid); setDelays(prev); toast.dismiss(t.id); }}>
          Undo
        </button>
      </span>
    ), { duration: 4000 });
  }

  async function loadDeleted() {
    if (!projectId) return;
    const res = await fetch(`/api/delays?projectId=${projectId}&deleted=only`);
    if (res.ok) setDeletedItems(await res.json());
    setDeletedLoaded(true);
  }

  function toggleDeletedHistory() {
    const next = !showDeletedHistory;
    setShowDeletedHistory(next);
    if (next && !deletedLoaded) loadDeleted();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const filtered = delays.filter((d) => {
    if (filterType && d.delayType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !d.responsibleParty?.toLowerCase().includes(q) && !d.cause?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const open = filtered.filter((d) => d.status !== "RESOLVED");
  const resolved = filtered.filter((d) => d.status === "RESOLVED");
  const totalOpen = delays.filter((d) => d.status !== "RESOLVED").length;
  const totalDays = delays.filter((d) => d.status !== "RESOLVED").reduce((s, d) => s + (d.daysDelayed ?? 0), 0);
  const criticalCount = delays.filter((d) => d.status === "OPEN").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Delays & Issues</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalOpen > 0 ? `${totalOpen} active delays impacting schedule` : "No active delays"}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Log Delay
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-2xl font-black">{criticalCount}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">Open Delays</p>
        </div>
        <div className="px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-300 text-2xl font-black">{totalOpen}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">Active (incl. Monitoring)</p>
        </div>
        <div className="px-5 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <p className="text-orange-300 text-2xl font-black">{totalDays}</p>
          <p className="text-slate-500 text-[10px] font-semibold uppercase">Total Days Delayed</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createDelay} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Log New Delay</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="What caused the delay?" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Delay Type *</label>
              <select value={fType} onChange={(e) => setFType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {DELAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Days Delayed</label>
              <input type="number" value={fDays} onChange={(e) => setFDays(e.target.value)} min="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cause</label>
              <input value={fCause} onChange={(e) => setFCause(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Root cause" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Responsible Party</label>
              <input value={fOwner} onChange={(e) => setFOwner(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Who's accountable?" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Start Date</label>
              <input type="date" value={fStart} onChange={(e) => setFStart(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">End Date</label>
              <input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Impact</label>
              <input value={fImpact} onChange={(e) => setFImpact(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="How does this affect the schedule?" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none" placeholder="Additional details..." />
            </div>
          </div>
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {creating ? "Creating..." : "Log Delay"}
          </button>
        </form>
      )}

      {/* Search and filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search delays..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Types</option>
          {DELAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Empty state */}
      {delays.length === 0 && !showForm && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 flex items-center justify-center">
            <Timer className="w-10 h-10 text-emerald-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Delays Logged</p>
          <p className="text-slate-500 text-sm mt-2">Track schedule delays and their root causes.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-red-400 hover:text-red-300 text-sm font-medium">
            Log your first delay →
          </button>
        </div>
      )}

      {/* Open delays */}
      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider px-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Active ({open.length})
          </h2>
          {open.map((d) => {
            const scfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.OPEN;
            const daysOpen = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000);
            return (
              <div key={d.id} className="rounded-xl border bg-slate-800/30 border-slate-700/50 hover:border-slate-600 p-5 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold">{d.title}</p>
                    {d.cause && <p className="text-slate-400 text-sm mt-1">Cause: {d.cause}</p>}
                    {d.impact && <p className="text-orange-400/80 text-sm mt-1">Impact: {d.impact}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <span className={cn("font-semibold", TYPE_COLORS[d.delayType] ?? "text-slate-400")}>{d.delayType}</span>
                      {d.daysDelayed != null && d.daysDelayed > 0 && (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" /> {d.daysDelayed}d delayed
                        </span>
                      )}
                      {d.responsibleParty && <span className="text-slate-500">Owner: {d.responsibleParty}</span>}
                      {d.activity && <span className="text-slate-600 truncate max-w-[200px]">{d.activity.activityDescription}</span>}
                      <span className="text-slate-600">{daysOpen}d open</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", scfg.bg, scfg.text, scfg.border)}>
                      {d.status.replace("_", " ")}
                    </span>
                    {d.status === "OPEN" && (
                      <button onClick={() => updateStatus(d.id, "MONITORING")}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-amber-600/20 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-600/30 transition-all">
                        Monitor
                      </button>
                    )}
                    {(d.status === "OPEN" || d.status === "MONITORING") && (
                      <button onClick={() => updateStatus(d.id, "RESOLVED")}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-600/30 transition-all">
                        Resolve
                      </button>
                    )}
                    <button onClick={() => deleteDelay(d.id)}
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

      {/* Resolved delays (collapsible) */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <button onClick={() => setShowResolved(!showResolved)} className="text-sm font-bold text-emerald-500 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-emerald-400 transition-colors">
            {showResolved ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <CheckCircle2 className="w-4 h-4" /> Resolved ({resolved.length})
          </button>
          {showResolved && resolved.map((d) => (
            <div key={d.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 font-medium">{d.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className={cn("font-semibold", TYPE_COLORS[d.delayType] ?? "text-slate-400")}>{d.delayType}</span>
                    {d.daysDelayed != null && <span className="text-slate-600">{d.daysDelayed}d delayed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteDelay(d.id)}
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
                <p className="text-slate-600 text-sm px-1">No deleted delays.</p>
              )}
              {deletedItems.map((d) => (
                <div key={d.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 font-medium line-through">{d.title}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        <span className={cn("font-semibold", TYPE_COLORS[d.delayType] ?? "text-slate-400")}>{d.delayType}</span>
                        {d.daysDelayed != null && <span>{d.daysDelayed}d delayed</span>}
                        {d.responsibleParty && <span>{d.responsibleParty}</span>}
                        {d.deletedAt && <span className="text-red-400/60">Deleted {new Date(d.deletedAt).toLocaleDateString()}</span>}
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
