"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, Loader2, TrendingUp, Users, Target, Clock, AlertTriangle,
  FileText, Filter, ChevronDown, MapPin, HardHat, ShieldAlert, CalendarDays,
  CheckCircle2, Ban, StickyNote, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  category: string | null;
  location: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  priority: string;
}

interface Conflict {
  id: string;
  title: string;
  severity: string;
  status: string;
  location: string | null;
  conflictType: string;
  dateIdentified: string;
  description: string | null;
}

interface AlertItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  alertType: string;
  locationText: string | null;
  createdAt: string;
  description: string | null;
  assignedTo?: { name: string } | null;
}

interface NoteItem {
  id: string;
  noteText: string;
  author: string | null;
  createdAt: string;
  activity?: { activityDescription: string } | null;
}

interface ConstraintItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  responsibleParty: string | null;
  neededBy: string | null;
}

type ReportType = "overview" | "weekly" | "3week" | "conflicts" | "alerts" | "notes" | "area" | "subs";

const REPORT_TABS: { key: ReportType; label: string; icon: typeof BarChart3 }[] = [
  { key: "overview", label: "Overview",      icon: BarChart3 },
  { key: "weekly",   label: "Weekly",        icon: CalendarDays },
  { key: "3week",    label: "3-Week",        icon: TrendingUp },
  { key: "conflicts",label: "Conflicts",     icon: AlertTriangle },
  { key: "alerts",   label: "Alerts",        icon: ShieldAlert },
  { key: "notes",    label: "Field Notes",   icon: StickyNote },
  { key: "area",     label: "Area Coord.",   icon: MapPin },
  { key: "subs",     label: "Subcontractors",icon: HardHat },
];

export default function ProjectReportsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [conflicts, setConflicts]   = useState<Conflict[]>([]);
  const [alerts, setAlerts]         = useState<AlertItem[]>([]);
  const [notes, setNotes]           = useState<NoteItem[]>([]);
  const [constraints, setConstraints] = useState<ConstraintItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [report, setReport]         = useState<ReportType>("overview");

  // Filters
  const [filterSub, setFilterSub]         = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      const bRes = await fetch(`/api/projects/${proj.id}/bundle`);
      if (bRes.ok) {
        const data = await bRes.json();
        setActivities(data.activities ?? []);
        setConflicts(data.conflicts ?? []);
        setAlerts(data.alerts ?? []);
        setNotes(data.notes ?? []);
        setConstraints(data.constraints ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  // Derived data
  const uniqueSubs = [...new Set(activities.map(a => a.responsibleSubcontractorRaw).filter(Boolean))] as string[];
  const uniqueLocations = [...new Set(activities.map(a => a.location).filter(Boolean))] as string[];

  // Apply filters
  let filtered = activities;
  if (filterSub) filtered = filtered.filter(a => a.responsibleSubcontractorRaw === filterSub);
  if (filterLocation) filtered = filtered.filter(a => a.location === filterLocation);
  if (filterStatus) filtered = filtered.filter(a => a.status === filterStatus);

  const total = filtered.length;
  const byStatus: Record<string, number> = {};
  const bySub: Record<string, { total: number; complete: number; delayed: number; inProgress: number }> = {};
  const byLocation: Record<string, { total: number; subs: Set<string>; statuses: Record<string, number> }> = {};

  filtered.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;

    const sub = a.responsibleSubcontractorRaw ?? "Unassigned";
    if (!bySub[sub]) bySub[sub] = { total: 0, complete: 0, delayed: 0, inProgress: 0 };
    bySub[sub].total++;
    if (a.status === "COMPLETE") bySub[sub].complete++;
    if (a.status === "DELAYED" || a.status === "BLOCKED") bySub[sub].delayed++;
    if (a.status === "IN_PROGRESS") bySub[sub].inProgress++;

    const loc = a.location ?? "No Location";
    if (!byLocation[loc]) byLocation[loc] = { total: 0, subs: new Set(), statuses: {} };
    byLocation[loc].total++;
    if (a.responsibleSubcontractorRaw) byLocation[loc].subs.add(a.responsibleSubcontractorRaw);
    byLocation[loc].statuses[a.status] = (byLocation[loc].statuses[a.status] || 0) + 1;
  });

  const completionRate = total > 0 ? Math.round(((byStatus["COMPLETE"] ?? 0) / total) * 100) : 0;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const threeWeekEnd = new Date(now); threeWeekEnd.setDate(threeWeekEnd.getDate() + 21);

  const thisWeekActivities = filtered.filter(a => {
    if (!a.plannedStart) return false;
    const s = new Date(a.plannedStart);
    return s >= now && s < weekEnd;
  });
  const threeWeekActivities = filtered.filter(a => {
    if (!a.plannedStart) return false;
    const s = new Date(a.plannedStart);
    return s >= now && s < threeWeekEnd;
  });

  const openConflicts = conflicts.filter(c => c.status !== "RESOLVED" && c.status !== "CLOSED");
  const urgentAlerts = alerts.filter(a => a.priority === "URGENT" && a.status !== "RESOLVED" && a.status !== "CLOSED");
  const filteredAlerts = filterPriority ? alerts.filter(a => a.priority === filterPriority) : alerts;

  const STATUS_BARS: Record<string, { color: string; label: string }> = {
    COMPLETE: { color: "bg-emerald-500", label: "Complete" },
    IN_PROGRESS: { color: "bg-amber-500", label: "In Progress" },
    PLANNED: { color: "bg-slate-500", label: "Planned" },
    DELAYED: { color: "bg-red-500", label: "Delayed" },
    BLOCKED: { color: "bg-orange-500", label: "Blocked" },
    MISSED: { color: "bg-rose-500", label: "Missed" },
  };

  function exportCSV() {
    let rows: string[][] = [];
    let filename = "report";

    switch (report) {
      case "overview":
      case "weekly":
      case "3week": {
        const list = report === "weekly" ? thisWeekActivities : report === "3week" ? threeWeekActivities : filtered;
        rows = [
          ["Activity", "Status", "% Complete", "Subcontractor", "Location", "Start", "Finish", "Priority"],
          ...list.map(a => [
            a.activityDescription, a.status, String(a.percentComplete),
            a.responsibleSubcontractorRaw ?? "", a.location ?? "",
            a.plannedStart ?? "", a.plannedFinish ?? "", a.priority,
          ]),
        ];
        filename = report === "weekly" ? "weekly-report" : report === "3week" ? "3week-lookahead" : "activities-overview";
        break;
      }
      case "conflicts":
        rows = [
          ["Title", "Severity", "Status", "Type", "Location", "Date Identified", "Description"],
          ...openConflicts.map(c => [c.title, c.severity, c.status, c.conflictType, c.location ?? "", c.dateIdentified, c.description ?? ""]),
        ];
        filename = "conflicts";
        break;
      case "alerts":
        rows = [
          ["Title", "Priority", "Status", "Type", "Location", "Created", "Description"],
          ...filteredAlerts.map(a => [a.title, a.priority, a.status, a.alertType, a.locationText ?? "", a.createdAt, a.description ?? ""]),
        ];
        filename = "alerts";
        break;
      case "notes":
        rows = [
          ["Note", "Author", "Created", "Related Activity"],
          ...notes.map(n => [n.noteText, n.author ?? "", n.createdAt, n.activity?.activityDescription ?? ""]),
        ];
        filename = "field-notes";
        break;
      case "area":
        rows = [
          ["Location", "Activities", "Crews", "Crew Names"],
          ...Object.entries(byLocation).map(([loc, d]) => [loc, String(d.total), String(d.subs.size), [...d.subs].join("; ")]),
        ];
        filename = "area-coordination";
        break;
      case "subs":
        rows = [
          ["Subcontractor", "Total", "Complete", "In Progress", "Delayed", "% Complete"],
          ...Object.entries(bySub).map(([sub, d]) => [
            sub, String(d.total), String(d.complete), String(d.inProgress), String(d.delayed),
            d.total > 0 ? String(Math.round((d.complete / d.total) * 100)) : "0",
          ]),
        ];
        filename = "subcontractors";
        break;
    }

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Project analytics and performance metrics</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/10">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ═══════ Report Tabs ═══════ */}
      <div className="flex flex-wrap gap-1 bg-slate-800/30 rounded-xl p-1 border border-slate-700/30">
        {REPORT_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setReport(tab.key)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                report === tab.key
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-slate-500 hover:text-white"
              )}>
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ Filters ═══════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        <select value={filterSub} onChange={e => setFilterSub(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Subcontractors</option>
          {uniqueSubs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Locations</option>
          {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_BARS).map(s => <option key={s} value={s}>{STATUS_BARS[s].label}</option>)}
        </select>
        {(report === "alerts") && (
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        )}
      </div>

      {total === 0 && report === "overview" ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 flex items-center justify-center">
            <BarChart3 className="w-10 h-10 text-emerald-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Data Yet</p>
          <p className="text-slate-500 text-sm mt-2">Upload a lookahead to generate reports.</p>
        </div>
      ) : (
        <>
          {/* ═══════ OVERVIEW ═══════ */}
          {report === "overview" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-sky-600 to-sky-700 rounded-2xl p-5 shadow-lg">
                  <Target className="w-5 h-5 text-sky-200 mb-2" />
                  <p className="text-3xl font-black text-white">{total}</p>
                  <p className="text-sky-200 text-xs font-semibold uppercase">Total Activities</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 shadow-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-200 mb-2" />
                  <p className="text-3xl font-black text-white">{completionRate}%</p>
                  <p className="text-emerald-200 text-xs font-semibold uppercase">Completion Rate</p>
                </div>
                <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-5 shadow-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-200 mb-2" />
                  <p className="text-3xl font-black text-white">{openConflicts.length}</p>
                  <p className="text-orange-200 text-xs font-semibold uppercase">Open Conflicts</p>
                </div>
                <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 shadow-lg">
                  <ShieldAlert className="w-5 h-5 text-red-200 mb-2" />
                  <p className="text-3xl font-black text-white">{urgentAlerts.length}</p>
                  <p className="text-red-200 text-xs font-semibold uppercase">Urgent Alerts</p>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
                  <h2 className="text-white font-bold text-lg mb-5">Status Breakdown</h2>
                  <div className="space-y-3">
                    {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                      const cfg = STATUS_BARS[status] ?? { color: "bg-slate-500", label: status };
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-300 text-sm font-medium">{cfg.label}</span>
                            <span className="text-white text-sm font-bold">{count} <span className="text-slate-500 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", cfg.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
                  <h2 className="text-white font-bold text-lg mb-5">Subcontractor Summary</h2>
                  <div className="space-y-3">
                    {Object.entries(bySub).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([sub, data]) => {
                      const pct = data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0;
                      return (
                        <div key={sub}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-300 text-sm font-medium truncate max-w-[200px]">{sub}</span>
                            <span className="text-white text-sm font-bold">{data.complete}/{data.total}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══════ WEEKLY ═══════ */}
          {report === "weekly" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-5">This Week ({thisWeekActivities.length} activities)</h2>
              {thisWeekActivities.length === 0 ? (
                <p className="text-slate-500 text-sm">No activities scheduled this week.</p>
              ) : (
                <div className="space-y-2">
                  {thisWeekActivities.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                      <div className={cn("w-2 h-2 rounded-full", STATUS_BARS[a.status]?.color ?? "bg-slate-500")} />
                      <span className="text-white text-sm flex-1 truncate">{a.activityDescription}</span>
                      <span className="text-slate-500 text-xs">{a.responsibleSubcontractorRaw ?? "—"}</span>
                      <span className="text-slate-600 text-xs">{a.location ?? "—"}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_BARS[a.status]?.color ?? "bg-slate-500", "text-white")}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ 3-WEEK ═══════ */}
          {report === "3week" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-5">3-Week Lookahead ({threeWeekActivities.length} activities)</h2>
              {threeWeekActivities.length === 0 ? (
                <p className="text-slate-500 text-sm">No activities in the 3-week window.</p>
              ) : (
                <div className="space-y-2">
                  {threeWeekActivities.map(a => {
                    const start = a.plannedStart ? new Date(a.plannedStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                        <span className="text-slate-500 text-xs w-16 flex-shrink-0">{start}</span>
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_BARS[a.status]?.color ?? "bg-slate-500")} />
                        <span className="text-white text-sm flex-1 truncate">{a.activityDescription}</span>
                        <span className="text-slate-500 text-xs">{a.responsibleSubcontractorRaw ?? "—"}</span>
                        <span className="text-slate-600 text-xs">{a.location ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════ CONFLICTS ═══════ */}
          {report === "conflicts" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-1">Open Conflicts</h2>
              <p className="text-slate-500 text-sm mb-5">{openConflicts.length} unresolved</p>
              {openConflicts.length === 0 ? (
                <p className="text-slate-500 text-sm">No open conflicts.</p>
              ) : (
                <div className="space-y-3">
                  {openConflicts.map(c => (
                    <div key={c.id} className="p-4 rounded-xl bg-slate-800/50 border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          c.severity === "CRITICAL" ? "text-red-300 bg-red-500/15 border-red-500/30" :
                          c.severity === "HIGH" ? "text-orange-300 bg-orange-500/15 border-orange-500/30" :
                          "text-amber-300 bg-amber-500/15 border-amber-500/30"
                        )}>{c.severity}</span>
                        <span className="text-slate-600 text-[10px]">{c.conflictType}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{c.title}</p>
                      {c.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{c.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                        {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location}</span>}
                        <span>{new Date(c.dateIdentified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ ALERTS ═══════ */}
          {report === "alerts" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-1">Alerts</h2>
              <p className="text-slate-500 text-sm mb-5">{filteredAlerts.length} total</p>
              {filteredAlerts.length === 0 ? (
                <p className="text-slate-500 text-sm">No alerts match filters.</p>
              ) : (
                <div className="space-y-3">
                  {filteredAlerts.map(a => (
                    <div key={a.id} className={cn("p-4 rounded-xl bg-slate-800/50 border",
                      a.priority === "URGENT" ? "border-red-500/30" :
                      a.priority === "HIGH" ? "border-orange-500/20" : "border-slate-700/30"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          a.priority === "URGENT" ? "text-red-300 bg-red-500/15 border-red-500/30" :
                          a.priority === "HIGH" ? "text-orange-300 bg-orange-500/15 border-orange-500/30" :
                          a.priority === "MEDIUM" ? "text-amber-300 bg-amber-500/15 border-amber-500/30" :
                          "text-slate-300 bg-slate-500/15 border-slate-500/30"
                        )}>{a.priority}</span>
                        <span className="text-slate-600 text-[10px]">{a.alertType} &bull; {a.status}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{a.title}</p>
                      {a.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{a.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                        {a.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.locationText}</span>}
                        {a.assignedTo && <span>Assigned: {a.assignedTo.name}</span>}
                        <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ FIELD NOTES ═══════ */}
          {report === "notes" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-1">Field Notes</h2>
              <p className="text-slate-500 text-sm mb-5">{notes.length} notes</p>
              {notes.length === 0 ? (
                <p className="text-slate-500 text-sm">No field notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(n => (
                    <div key={n.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
                      <p className="text-white text-sm">{n.noteText}</p>
                      <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                        <span>{n.author ?? "Unknown"}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                        {n.activity && <span className="text-slate-600 truncate max-w-[200px]">Re: {n.activity.activityDescription}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ AREA COORDINATION ═══════ */}
          {report === "area" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-1">Area Coordination</h2>
              <p className="text-slate-500 text-sm mb-5">Work density and crew stacking by location</p>
              {Object.keys(byLocation).length === 0 ? (
                <p className="text-slate-500 text-sm">No location data.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byLocation)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([loc, data]) => {
                      const multiCrew = data.subs.size >= 2;
                      return (
                        <div key={loc} className={cn("p-4 rounded-xl border", multiCrew ? "bg-orange-500/5 border-orange-500/20" : "bg-slate-800/50 border-slate-700/30")}>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className={cn("w-4 h-4", multiCrew ? "text-orange-400" : "text-violet-400")} />
                            <span className="text-white font-bold">{loc}</span>
                            <span className="text-slate-500 text-xs">({data.total} activities)</span>
                            {multiCrew && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
                                {data.subs.size} crews — stacking risk
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[...data.subs].map(s => (
                              <span key={s} className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold">{s}</span>
                            ))}
                          </div>
                          <div className="flex gap-3 mt-2 text-xs">
                            {Object.entries(data.statuses).map(([s, c]) => (
                              <span key={s} className="text-slate-500">{STATUS_BARS[s]?.label ?? s}: <span className="text-white font-bold">{c}</span></span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ═══════ SUBCONTRACTORS ═══════ */}
          {report === "subs" && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-5">Subcontractor Work Report</h2>
              {Object.keys(bySub).length === 0 ? (
                <p className="text-slate-500 text-sm">No subcontractor data.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(bySub).sort((a, b) => b[1].total - a[1].total).map(([sub, data]) => {
                    const pct = data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0;
                    return (
                      <div key={sub} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <HardHat className="w-4 h-4 text-amber-400" />
                            <span className="text-white font-bold">{sub}</span>
                          </div>
                          <span className="text-emerald-400 text-sm font-bold">{pct}% complete</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden mb-3">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <div>
                            <p className="text-white font-bold">{data.total}</p>
                            <p className="text-slate-500 text-[10px] uppercase">Total</p>
                          </div>
                          <div>
                            <p className="text-emerald-400 font-bold">{data.complete}</p>
                            <p className="text-slate-500 text-[10px] uppercase">Complete</p>
                          </div>
                          <div>
                            <p className="text-amber-400 font-bold">{data.inProgress}</p>
                            <p className="text-slate-500 text-[10px] uppercase">In Progress</p>
                          </div>
                          <div>
                            <p className="text-red-400 font-bold">{data.delayed}</p>
                            <p className="text-slate-500 text-[10px] uppercase">Delayed</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
