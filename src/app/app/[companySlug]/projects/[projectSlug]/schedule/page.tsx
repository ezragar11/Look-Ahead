"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { TableProperties, Loader2, Search, Filter, MapPin, ChevronLeft, ChevronRight, Check, X, RefreshCw, Printer, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Activity {
  id: string;
  activityDescription: string;
  category: string | null;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  location: string | null;
  priority: string;
  needsFollowUp: boolean;
}

const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETE", "DELAYED", "BLOCKED", "MISSED"];

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  PLANNED:     { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/30" },
  IN_PROGRESS: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
  COMPLETE:    { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  DELAYED:     { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/30" },
  BLOCKED:     { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30" },
  MISSED:      { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30" },
};

const PAGE_SIZE = 50;

export default function SchedulePage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSub, setFilterSub]   = useState<string>("ALL");
  const [filterCat, setFilterCat]   = useState<string>("ALL");
  const [page, setPage]             = useState(1);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("PLANNED");
  const [projectId, setProjectId]   = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const aRes = await fetch(`/api/activities?projectId=${proj.id}`);
    if (aRes.ok) setActivities(await aRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  const subs       = useMemo(() => [...new Set(activities.map(a => a.responsibleSubcontractorRaw ?? "Unassigned"))].sort(), [activities]);
  const categories = useMemo(() => [...new Set(activities.map(a => a.category).filter(Boolean) as string[])].sort(), [activities]);
  const statuses   = useMemo(() => [...new Set(activities.map(a => a.status))].sort(), [activities]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (filterSub !== "ALL" && (a.responsibleSubcontractorRaw ?? "Unassigned") !== filterSub) return false;
      if (filterCat !== "ALL" && (a.category ?? "Uncategorized") !== filterCat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.activityDescription.toLowerCase().includes(q) &&
            !(a.responsibleSubcontractorRaw ?? "").toLowerCase().includes(q) &&
            !(a.location ?? "").toLowerCase().includes(q) &&
            !(a.category ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activities, filterStatus, filterSub, filterCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || filterStatus !== "ALL" || filterSub !== "ALL" || filterCat !== "ALL";

  function clearFilters() {
    setSearch(""); setFilterStatus("ALL"); setFilterSub("ALL"); setFilterCat("ALL"); setPage(1);
  }

  async function handleStatusUpdate(activityId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Status updated");
      setEditingId(null);
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: newStatus } : a));
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    try {
      const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Activity deleted");
        setActivities(prev => prev.filter(a => a.id !== id));
      } else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
  }

  async function saveEdit() {
    if (!editingActivity) return;
    try {
      const res = await fetch(`/api/activities/${editingActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDescription: editingActivity.activityDescription,
          location: editingActivity.location || null,
          plannedStart: editingActivity.plannedStart || null,
          plannedFinish: editingActivity.plannedFinish || null,
          responsibleSubcontractorRaw: editingActivity.responsibleSubcontractorRaw || null,
        }),
      });
      if (res.ok) {
        toast.success("Activity updated");
        setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...a, ...editingActivity } : a));
        setEditingActivity(null);
      } else toast.error("Failed to update");
    } catch { toast.error("Failed to update"); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} of {activities.length} activities
            {hasFilters && <span className="text-sky-400 ml-1">(filtered)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${base}/print`}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 border border-sky-500/30 text-sky-300 rounded-xl text-sm font-semibold hover:bg-sky-600/30 transition-all">
            <Printer className="w-4 h-4" /> Print Lookahead
          </Link>
          <button onClick={load} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all" title="Refresh">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search activities, subs, locations..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 transition-all"
            />
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer">
            <option value="ALL">All Statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSub} onChange={(e) => { setFilterSub(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer max-w-[200px]">
            <option value="ALL">All Subcontractors</option>
            {subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {categories.length > 0 && (
            <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer max-w-[180px]">
              <option value="ALL">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-all">
              Clear
            </button>
          )}
        </div>

        {/* Status chips row */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUSES.map((status) => {
            const count = activities.filter(a => a.status === status).length;
            if (count === 0) return null;
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PLANNED;
            return (
              <button
                key={status}
                onClick={() => { setFilterStatus(filterStatus === status ? "ALL" : status); setPage(1); }}
                className={cn(
                  "text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all",
                  filterStatus === status ? cn(cfg.bg, cfg.text, cfg.border, "ring-1 ring-white/10") : "bg-slate-800/30 text-slate-500 border-slate-700/50 hover:text-slate-300"
                )}
              >
                {status.replace("_", " ")} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {activities.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 flex items-center justify-center">
            <TableProperties className="w-10 h-10 text-violet-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Activities</p>
          <p className="text-slate-500 text-sm mt-2">Upload a lookahead to populate the schedule.</p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                  <th className="px-5 py-3.5 text-left font-semibold">Activity</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Category</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Subcontractor</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Location</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Start</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Finish</th>
                  <th className="px-4 py-3.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Progress</th>
                  <th className="px-3 py-3.5 text-right font-semibold w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {pageItems.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PLANNED;
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 max-w-[300px]">
                        <p className="text-white font-medium truncate">{a.activityDescription}</p>
                        {a.needsFollowUp && <span className="text-fuchsia-400 text-[10px] font-semibold">⚑ Needs Follow-Up</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {a.category ? (
                          <span className="text-xs text-slate-300 bg-slate-700/50 px-2.5 py-0.5 rounded-full">{a.category}</span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sky-400 text-xs font-medium">{a.responsibleSubcontractorRaw ?? <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">
                        {a.location ? (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" />{a.location}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{a.plannedStart ? new Date(a.plannedStart).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{a.plannedFinish ? new Date(a.plannedFinish).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3.5">
                        {editingId === a.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              autoFocus
                              className="text-xs bg-slate-900 border border-sky-500/50 rounded-lg px-2 py-1 text-white focus:outline-none"
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => handleStatusUpdate(a.id, editStatus)}
                              className="p-1 bg-sky-600 text-white rounded-md hover:bg-sky-500 transition-colors">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(a.id); setEditStatus(a.status); }}
                            className="transition-opacity hover:opacity-80"
                            title="Click to change status"
                          >
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cfg.bg, cfg.text, cfg.border)}>
                              {a.status.replace("_", " ")}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", a.percentComplete >= 100 ? "bg-emerald-500" : a.percentComplete > 0 ? "bg-sky-500" : "bg-slate-600")} style={{ width: `${a.percentComplete}%` }} />
                          </div>
                          <span className="text-slate-400 text-xs w-8 text-right">{a.percentComplete}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingActivity({ ...a })} title="Edit"
                            className="p-1.5 text-slate-500 hover:text-sky-400 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteActivity(a.id)} title="Delete"
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 font-medium px-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">Edit Activity</h2>
              <button onClick={() => setEditingActivity(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium">Description</label>
                <input value={editingActivity.activityDescription}
                  onChange={(e) => setEditingActivity({ ...editingActivity, activityDescription: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Subcontractor</label>
                  <input value={editingActivity.responsibleSubcontractorRaw ?? ""}
                    onChange={(e) => setEditingActivity({ ...editingActivity, responsibleSubcontractorRaw: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Location</label>
                  <input value={editingActivity.location ?? ""}
                    onChange={(e) => setEditingActivity({ ...editingActivity, location: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Planned Start</label>
                  <input type="date" value={editingActivity.plannedStart?.split("T")[0] ?? ""}
                    onChange={(e) => setEditingActivity({ ...editingActivity, plannedStart: e.target.value || null })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Planned Finish</label>
                  <input type="date" value={editingActivity.plannedFinish?.split("T")[0] ?? ""}
                    onChange={(e) => setEditingActivity({ ...editingActivity, plannedFinish: e.target.value || null })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500/50" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 text-slate-400 text-sm hover:text-white transition">Cancel</button>
                <button onClick={saveEdit}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
