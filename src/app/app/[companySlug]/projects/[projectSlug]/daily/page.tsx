"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CalendarDays, Loader2, CheckCircle2, Clock, AlertTriangle, Zap,
  ChevronLeft, ChevronRight, HardHat, MapPin, ShieldAlert,
  Package, ClipboardCheck, RefreshCw, Eye, MessageSquarePlus,
  Ban, PauseCircle, MoveRight, StickyNote, BellRing, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  category: string | null;
  location: string | null;
  priority: string;
  needsFollowUp: boolean;
}

interface Conflict {
  id: string;
  title: string;
  severity: string;
  status: string;
  location: string | null;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string; bg: string; border: string; dot: string }> = {
  PLANNED:     { icon: Clock,         label: "Planned",     color: "text-slate-300",   bg: "bg-slate-500/10",   border: "border-slate-500/20", dot: "bg-slate-400" },
  IN_PROGRESS: { icon: Zap,           label: "In Progress", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/20", dot: "bg-amber-400" },
  COMPLETE:    { icon: CheckCircle2,  label: "Complete",    color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  DELAYED:     { icon: AlertTriangle, label: "Delayed",     color: "text-red-300",     bg: "bg-red-500/10",     border: "border-red-500/20", dot: "bg-red-400" },
  BLOCKED:     { icon: AlertTriangle, label: "Blocked",     color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/20", dot: "bg-orange-400" },
  MISSED:      { icon: AlertTriangle, label: "Missed",      color: "text-rose-300",    bg: "bg-rose-500/10",    border: "border-rose-500/20", dot: "bg-rose-400" },
};

type ViewMode = "all" | "bySub" | "byLocation" | "byCategory";

/* ── Page ── */
export default function DailyWorkPlanPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [conflicts, setConflicts]   = useState<Conflict[]>([]);
  const [projectId, setProjectId]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [viewDate, setViewDate]     = useState(new Date());
  const [viewMode, setViewMode]     = useState<ViewMode>("bySub");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [saving, setSaving]         = useState<Record<string, boolean>>({});

  // Inline action modals
  const [noteModal, setNoteModal]   = useState<string | null>(null); // activityId
  const [noteText, setNoteText]     = useState("");
  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertPriority, setAlertPriority] = useState("MEDIUM");
  const [moveModal, setMoveModal]   = useState<string | null>(null);
  const [moveDate, setMoveDate]     = useState("");

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/activities?projectId=${proj.id}`),
        fetch(`/api/conflicts?projectId=${proj.id}`),
      ]);
      if (aRes.ok) setActivities(await aRes.json());
      if (cRes.ok) setConflicts(await cRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  const dateStr = viewDate.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = dateStr === todayStr;

  // Filter activities for selected date
  let dayActivities = activities.filter((a) => {
    if (!a.plannedStart) return false;
    const s = new Date(a.plannedStart).toISOString().split("T")[0];
    const e = a.plannedFinish ? new Date(a.plannedFinish).toISOString().split("T")[0] : s;
    return dateStr >= s && dateStr <= e;
  });

  if (statusFilter) dayActivities = dayActivities.filter(a => a.status === statusFilter);

  // Status counts
  const byStatus: Record<string, number> = {};
  const allDay = activities.filter(a => {
    if (!a.plannedStart) return false;
    const s = new Date(a.plannedStart).toISOString().split("T")[0];
    const e = a.plannedFinish ? new Date(a.plannedFinish).toISOString().split("T")[0] : s;
    return dateStr >= s && dateStr <= e;
  });
  allDay.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

  // Subs + locations for this day (computed BEFORE dayConflicts)
  const subsToday = [...new Set(allDay.map(a => a.responsibleSubcontractorRaw).filter(Boolean))];
  const locationsToday = [...new Set(allDay.map(a => a.location).filter((x): x is string => !!x))];

  // Group by selected mode
  function groupActivities(): Array<{ key: string; label: string; items: Activity[] }> {
    const map = new Map<string, Activity[]>();
    dayActivities.forEach(a => {
      let key: string;
      switch (viewMode) {
        case "bySub":      key = a.responsibleSubcontractorRaw ?? "Unassigned"; break;
        case "byLocation": key = a.location ?? "No Location"; break;
        case "byCategory": key = a.category ?? "Uncategorized"; break;
        default:           key = "All Activities";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, items]) => ({ key, label: key, items }));
  }

  const groups = groupActivities();

  // Open conflicts relevant to today's active areas
  const dayConflicts = conflicts.filter(c => {
    if (c.status !== "OPEN" && c.status !== "UNDER_REVIEW") return false;
    if (c.location && locationsToday.length > 0) {
      return locationsToday.some(l => l.toLowerCase() === (c.location ?? "").toLowerCase());
    }
    return true;
  });

  // Inline status update
  async function updateStatus(activityId: string, newStatus: string) {
    setSaving(prev => ({ ...prev, [activityId]: true }));
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: newStatus } : a));
      }
    } catch { /* ignore */ }
    finally { setSaving(prev => ({ ...prev, [activityId]: false })); }
  }

  // Add field note
  async function submitNote() {
    if (!noteModal || !noteText.trim() || !projectId) return;
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, activityId: noteModal, noteText: noteText.trim(), isPublic: true }),
      });
    } catch { /* ignore */ }
    setNoteModal(null);
    setNoteText("");
  }

  // Add alert
  async function submitAlert() {
    if (!alertModal || !alertTitle.trim() || !projectId) return;
    const activity = activities.find(a => a.id === alertModal);
    try {
      await fetch(`/api/projects/${projectId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alertTitle.trim(),
          priority: alertPriority,
          alertType: "GENERAL",
          activityId: alertModal,
          locationText: activity?.location ?? undefined,
        }),
      });
    } catch { /* ignore */ }
    setAlertModal(null);
    setAlertTitle("");
    setAlertPriority("MEDIUM");
  }

  // Move activity to another date
  async function submitMove() {
    if (!moveModal || !moveDate) return;
    try {
      const activity = activities.find(a => a.id === moveModal);
      const start = new Date(moveDate + "T07:00:00");
      let finish = start;
      if (activity?.plannedStart && activity?.plannedFinish) {
        const dur = new Date(activity.plannedFinish).getTime() - new Date(activity.plannedStart).getTime();
        finish = new Date(start.getTime() + dur);
      }
      await fetch(`/api/activities/${moveModal}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStart: start.toISOString(), plannedFinish: finish.toISOString() }),
      });
      await load();
    } catch { /* ignore */ }
    setMoveModal(null);
    setMoveDate("");
  }

  function shiftDay(n: number) {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + n);
    setViewDate(d);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════ Header + Controls ═══════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily Work Plan</h1>
          <p className="text-slate-500 text-sm mt-1">
            {viewDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            {isToday && <span className="text-sky-400 ml-2 font-semibold">(Today)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDay(-1)} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setViewDate(new Date())} className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600/80 to-violet-600/80 text-white text-xs font-semibold">Today</button>
          <button onClick={() => shiftDay(1)} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-700/50 mx-1" />
          <button onClick={load} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/30 text-slate-400 hover:text-white transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href={`${base}/huddle`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/15 border border-amber-500/20 hover:border-amber-500/40 text-amber-300 text-xs font-semibold transition-all">
            <Eye className="w-3.5 h-3.5" /> Huddle View
          </Link>
        </div>
      </div>

      {/* ═══════ Quick Stats Strip ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3 text-center">
          <p className="text-2xl font-black text-white">{allDay.length}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase">Activities</p>
        </div>
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{subsToday.length}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase">Crews</p>
        </div>
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3 text-center">
          <p className="text-2xl font-black text-violet-400">{locationsToday.length}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase">Locations</p>
        </div>
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{byStatus["COMPLETE"] ?? 0}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase">Complete</p>
        </div>
      </div>

      {/* ═══════ Status Filter + View Mode ═══════ */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn("text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all",
            statusFilter === null
              ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
              : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-white"
          )}
        >
          All ({allDay.length})
        </button>
        {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PLANNED;
          const active = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(active ? null : status)}
              className={cn("text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all",
                active ? cn(cfg.bg, cfg.color, cfg.border) : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-white"
              )}
            >
              {cfg.label} ({count})
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1">
          {(["bySub", "byLocation", "byCategory", "all"] as ViewMode[]).map(mode => {
            const labels: Record<ViewMode, string> = { bySub: "By Crew", byLocation: "By Location", byCategory: "By Category", all: "Flat" };
            return (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all",
                  viewMode === mode
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "text-slate-500 hover:text-white"
                )}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════ Open Conflicts Today ═══════ */}
      {dayConflicts.length > 0 && (
        <div className="bg-orange-500/5 rounded-xl border border-orange-500/15 p-4">
          <p className="text-orange-400 text-sm font-bold flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> {dayConflicts.length} Open Conflict{dayConflicts.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {dayConflicts.slice(0, 3).map(c => (
              <Link key={c.id} href={`${base}/conflicts`} className="block text-slate-300 text-sm hover:text-white transition-colors px-2 py-1">
                &bull; {c.title}{c.location ? ` (${c.location})` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ Activity Groups ═══════ */}
      {dayActivities.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 flex items-center justify-center">
            <CalendarDays className="w-10 h-10 text-violet-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Activities Scheduled</p>
          <p className="text-slate-500 text-sm mt-2">
            {statusFilter ? "No activities match this filter." : "No work items are planned for this date."}
          </p>
          {statusFilter && (
            <button onClick={() => setStatusFilter(null)} className="text-sky-400 text-sm mt-3 hover:text-sky-300">Clear filter</button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key}>
              {viewMode !== "all" && (
                <div className="flex items-center gap-2 mb-3">
                  {viewMode === "bySub" && <HardHat className="w-4 h-4 text-amber-400" />}
                  {viewMode === "byLocation" && <MapPin className="w-4 h-4 text-violet-400" />}
                  {viewMode === "byCategory" && <Package className="w-4 h-4 text-cyan-400" />}
                  <p className="text-white font-bold">{group.label}</p>
                  <span className="text-slate-600 text-xs">({group.items.length})</span>
                </div>
              )}

              <div className="space-y-2">
                {group.items.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PLANNED;
                  const Icon = cfg.icon;
                  const isSaving = saving[a.id];

                  return (
                    <div key={a.id} className={cn("rounded-xl border p-4 transition-all hover:border-slate-600", cfg.bg, cfg.border)}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                          <Icon className={cn("w-5 h-5", cfg.color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold">{a.activityDescription}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {viewMode !== "bySub" && a.responsibleSubcontractorRaw && (
                              <span className="text-slate-400 text-xs flex items-center gap-1">
                                <HardHat className="w-3 h-3 text-amber-500/60" /> {a.responsibleSubcontractorRaw}
                              </span>
                            )}
                            {viewMode !== "byCategory" && a.category && (
                              <span className="text-slate-500 text-xs">{a.category}</span>
                            )}
                            {viewMode !== "byLocation" && a.location && (
                              <span className="text-slate-500 text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {a.location}
                              </span>
                            )}
                            {a.needsFollowUp && (
                              <span className="text-purple-400 text-xs flex items-center gap-1">
                                <ClipboardCheck className="w-3 h-3" /> Follow-Up
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cfg.bg, cfg.color, cfg.border)}>
                            {cfg.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", a.percentComplete >= 100 ? "bg-emerald-500" : "bg-sky-500")} style={{ width: `${a.percentComplete}%` }} />
                            </div>
                            <span className="text-slate-500 text-[10px] w-8 text-right">{a.percentComplete}%</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Action bar ── */}
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-700/30 flex-wrap">
                        {/* Status actions */}
                        {a.status === "PLANNED" && (
                          <button onClick={() => updateStatus(a.id, "IN_PROGRESS")} disabled={isSaving}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Start
                          </button>
                        )}
                        {a.status !== "COMPLETE" && (
                          <button onClick={() => updateStatus(a.id, "COMPLETE")} disabled={isSaving}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </button>
                        )}
                        {a.status !== "DELAYED" && a.status !== "COMPLETE" && (
                          <button onClick={() => updateStatus(a.id, "DELAYED")} disabled={isSaving}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                            <PauseCircle className="w-3 h-3" /> Delayed
                          </button>
                        )}
                        {a.status !== "BLOCKED" && a.status !== "COMPLETE" && (
                          <button onClick={() => updateStatus(a.id, "BLOCKED")} disabled={isSaving}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                            <Ban className="w-3 h-3" /> Blocked
                          </button>
                        )}

                        <div className="w-px h-4 bg-slate-700/50 mx-1" />

                        {/* Add note */}
                        <button onClick={() => { setNoteModal(a.id); setNoteText(""); }}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center gap-1">
                          <StickyNote className="w-3 h-3" /> Note
                        </button>

                        {/* Add alert */}
                        <button onClick={() => { setAlertModal(a.id); setAlertTitle(""); setAlertPriority("MEDIUM"); }}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center gap-1">
                          <BellRing className="w-3 h-3" /> Alert
                        </button>

                        {/* Move date */}
                        <button onClick={() => { setMoveModal(a.id); setMoveDate(""); }}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center gap-1">
                          <MoveRight className="w-3 h-3" /> Move
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ Subs Scheduled ═══════ */}
      {subsToday.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Subcontractors Scheduled</p>
          <div className="flex flex-wrap gap-2">
            {subsToday.map(sub => (
              <span key={sub!} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">{sub}</span>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ Add Note Modal ═══════ */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setNoteModal(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Add Field Note</h3>
              <button onClick={() => setNoteModal(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="What happened on site?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 h-24 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setNoteModal(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submitNote} disabled={!noteText.trim()}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-500 disabled:opacity-40 transition-colors">
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Add Alert Modal ═══════ */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAlertModal(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Create Alert</h3>
              <button onClick={() => setAlertModal(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={alertTitle}
              onChange={e => setAlertTitle(e.target.value)}
              placeholder="Alert title"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 mb-3"
              autoFocus
            />
            <select value={alertPriority} onChange={e => setAlertPriority(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAlertModal(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submitAlert} disabled={!alertTitle.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-40 transition-colors">
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Move Date Modal ═══════ */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMoveModal(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Move to Another Date</h3>
              <button onClick={() => setMoveModal(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <input
              type="date"
              value={moveDate}
              onChange={e => setMoveDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setMoveModal(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submitMove} disabled={!moveDate}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-40 transition-colors">
                Move Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
