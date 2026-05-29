"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, AlertTriangle, ShieldAlert, Upload,
  Calendar, Loader2, HardHat, ArrowRight, FolderOpen, TrendingDown,
  Zap, Layers, Brain, Target, MapPin, Users, Flame, Eye, Megaphone,
  Activity, ChevronRight, Circle, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface WeekSummary {
  label: string;
  start: string;
  end: string;
  total: number;
  byStatus: { planned: number; inProgress: number; complete: number; delayed: number };
  subs: string[];
}

interface ActivityItem {
  id: string;
  activityDescription: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  category: string | null;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  location: string | null;
  priority: string;
  needsFollowUp: boolean;
}

interface AlertSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  projectLocation: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
}

interface DashData {
  project: {
    id: string;
    projectName: string;
    slug: string | null;
    status: string;
    location: string | null;
    client: string | null;
    contractor: string | null;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    _count: {
      activities: number; lookaheads: number; documents: number;
      conflicts: number; delays: number; constraints: number;
    };
  };
  stats: {
    total: number; planned: number; inProgress: number; complete: number;
    delayed: number; blocked: number; missed: number;
    openConflicts: number; openConstraints: number;
    todayCount: number; thisWeekCount: number; overdueCount: number; subsOnSite: number;
    urgentAlerts?: number; myAlerts?: number; openAlerts?: number;
  };
  weekStart: string;
  weeks: WeekSummary[];
  todayActivities: ActivityItem[];
  subsThisWeek: string[];
  overdue: ActivityItem[];
  recentActivities: ActivityItem[];
  topAlerts?: AlertSummary[];
}

const STATUS_INDICATOR: Record<string, { dot: string; label: string }> = {
  PLANNED: { dot: "bg-slate-400", label: "Planned" },
  IN_PROGRESS: { dot: "bg-amber-400", label: "Active" },
  COMPLETE: { dot: "bg-emerald-400", label: "Done" },
  DELAYED: { dot: "bg-red-400", label: "Delayed" },
  BLOCKED: { dot: "bg-orange-400", label: "Blocked" },
  MISSED: { dot: "bg-rose-500", label: "Missed" },
};

/* ── Page ── */
export default function ProjectDashboardPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}/dashboard`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  const base = `/app/${companySlug}/projects/${projectSlug}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <FolderOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <p className="text-slate-400 text-lg">Project not found</p>
      </div>
    );
  }

  const s = data.stats;
  const p = data.project;
  const completionPct = s.total > 0 ? Math.round((s.complete / s.total) * 100) : 0;
  const issueCount = s.openConflicts + s.openConstraints + s.overdueCount;

  // Group today's activities by location for area coordination
  const byLocation: Record<string, ActivityItem[]> = {};
  data.todayActivities.forEach((a) => {
    const loc = a.location || "Unassigned Area";
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(a);
  });

  return (
    <div className="space-y-5">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight truncate">{p.projectName}</h1>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
              p.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" :
              p.status === "ON_HOLD" ? "bg-amber-500/15 text-amber-400" :
              "bg-slate-500/15 text-slate-400"
            )}>{p.status}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            {p.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</span>}
            {p.client && <span>Client: {p.client}</span>}
            {p.contractor && <span>GC: {p.contractor}</span>}
          </div>
        </div>
        <Link href={`${base}/upload`}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </Link>
      </div>

      {/* ═══ METRICS ROW ═══ */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <MetricCard value={s.todayCount} label="Today" accent="sky" />
        <MetricCard value={s.thisWeekCount} label="This Week" accent="violet" />
        <MetricCard value={s.subsOnSite} label="Subs" accent="amber" />
        <MetricCard value={`${completionPct}%`} label="Complete" accent="emerald" />
        <MetricCard value={s.overdueCount} label="Overdue" accent={s.overdueCount > 0 ? "red" : "slate"} />
        <MetricCard value={issueCount} label="Issues" accent={issueCount > 0 ? "orange" : "slate"} />
      </div>

      {/* ═══ 3-WEEK TIMELINE ═══ */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-4 h-4 text-sky-400" /> 3-Week Look-Ahead
          </h2>
          <Link href={`${base}/calendar`} className="text-sky-400 hover:text-sky-300 text-[11px] font-medium flex items-center gap-1">
            Calendar <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.weeks.map((week, i) => {
            const ws = new Date(week.start);
            const we = new Date(week.end);
            const labels = ["THIS WEEK", "NEXT WEEK", "WEEK 3"];
            const accents = ["border-sky-500/30", "border-violet-500/30", "border-emerald-500/30"];
            const textAccents = ["text-sky-400", "text-violet-400", "text-emerald-400"];

            return (
              <div key={i} className={cn("rounded-lg border bg-slate-800/30 p-3", accents[i])}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", textAccents[i])}>{labels[i]}</span>
                    <p className="text-slate-500 text-[10px]">
                      {ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {we.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-white text-lg font-mono font-bold">{week.total}</span>
                </div>
                {week.total > 0 && (
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700/50 mb-2">
                    {week.byStatus.complete > 0 && <div className="bg-emerald-500" style={{ width: `${(week.byStatus.complete / week.total) * 100}%` }} />}
                    {week.byStatus.inProgress > 0 && <div className="bg-amber-500" style={{ width: `${(week.byStatus.inProgress / week.total) * 100}%` }} />}
                    {week.byStatus.planned > 0 && <div className="bg-slate-500" style={{ width: `${(week.byStatus.planned / week.total) * 100}%` }} />}
                    {week.byStatus.delayed > 0 && <div className="bg-red-500" style={{ width: `${(week.byStatus.delayed / week.total) * 100}%` }} />}
                  </div>
                )}
                <div className="flex gap-3 text-[10px]">
                  <span className="text-emerald-400">{week.byStatus.complete} done</span>
                  <span className="text-amber-400">{week.byStatus.inProgress} active</span>
                  <span className="text-slate-400">{week.byStatus.planned} planned</span>
                  {week.byStatus.delayed > 0 && <span className="text-red-400">{week.byStatus.delayed} issue</span>}
                </div>
                {week.subs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {week.subs.slice(0, 4).map((sub) => (
                      <span key={sub} className="text-[9px] text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded truncate max-w-[100px]">{sub}</span>
                    ))}
                    {week.subs.length > 4 && <span className="text-[9px] text-slate-600">+{week.subs.length - 4}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ MAIN 2-COL: WORK QUEUE + ISSUES ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT: Work Queue + Area Coordination (3/5 width) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Today's Work Queue */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800/60">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/40">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-sky-400" /> Work Queue — Today
              </h3>
              <Link href={`${base}/daily`} className="text-sky-400 hover:text-sky-300 text-[11px] font-medium flex items-center gap-1">
                Daily Log <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-slate-800/30">
              {data.todayActivities.length === 0 ? (
                <p className="text-slate-600 text-xs py-6 text-center">No activities scheduled today</p>
              ) : (
                data.todayActivities.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_INDICATOR[a.status]?.dot ?? "bg-slate-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs truncate">{a.activityDescription}</p>
                    </div>
                    <span className="text-slate-600 text-[10px] truncate max-w-[80px]">{a.responsibleSubcontractorRaw ?? "—"}</span>
                    {a.location && <span className="text-slate-700 text-[10px] truncate max-w-[60px]">{a.location}</span>}
                  </div>
                ))
              )}
              {data.todayActivities.length > 10 && (
                <div className="px-4 py-2">
                  <span className="text-sky-500 text-[11px]">+{data.todayActivities.length - 10} more activities</span>
                </div>
              )}
            </div>
          </div>

          {/* Area Coordination */}
          {Object.keys(byLocation).length > 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/40">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Area Coordination
                </h3>
                <Link href={`${base}/locations`} className="text-sky-400 hover:text-sky-300 text-[11px] font-medium flex items-center gap-1">
                  Locations <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-slate-800/30">
                {Object.entries(byLocation).slice(0, 6).map(([loc, acts]) => (
                  <div key={loc} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-xs font-medium">{loc}</span>
                      <span className="text-slate-600 text-[10px]">{acts.length} {acts.length === 1 ? "task" : "tasks"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(acts.map(a => a.responsibleSubcontractorRaw).filter(Boolean))].slice(0, 3).map((sub) => (
                        <span key={sub} className="text-[9px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">{sub}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subs on Site */}
          {data.subsThisWeek.length > 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <HardHat className="w-3.5 h-3.5 text-amber-400" /> Subs on Site
                </h3>
                <Link href={`${base}/subs`} className="text-sky-400 hover:text-sky-300 text-[11px] font-medium flex items-center gap-1">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.subsThisWeek.map((sub) => (
                  <span key={sub} className="px-2 py-1 rounded bg-slate-800 border border-slate-700/50 text-slate-300 text-[11px] font-medium">{sub}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Issues Panel (2/5 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Alerts */}
          {(data.topAlerts ?? []).length > 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-red-500/20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/10">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5" /> Alerts
                </h3>
                <Link href={`${base}/alerts`} className="text-red-400 hover:text-red-300 text-[11px] font-medium flex items-center gap-1">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-slate-800/30">
                {(data.topAlerts ?? []).map((al) => (
                  <Link key={al.id} href={`${base}/alerts`} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-red-500/5 transition-colors">
                    <TriangleAlert className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", al.priority === "URGENT" ? "text-red-400" : "text-orange-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs truncate">{al.title}</p>
                      <p className="text-slate-600 text-[10px]">
                        {al.priority} {al.projectLocation ? `· ${al.projectLocation.name}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Overdue */}
          {data.overdue.length > 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/40">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5" /> Overdue
                </h3>
                <Link href={`${base}/delays`} className="text-sky-400 hover:text-sky-300 text-[11px] font-medium flex items-center gap-1">
                  Delays <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-slate-800/30">
                {data.overdue.slice(0, 6).map((a) => {
                  const daysLate = a.plannedFinish ? Math.max(0, Math.floor((Date.now() - new Date(a.plannedFinish).getTime()) / 86400000)) : 0;
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs truncate">{a.activityDescription}</p>
                        <p className="text-slate-600 text-[10px]">{a.responsibleSubcontractorRaw ?? "Unassigned"}</p>
                      </div>
                      <span className="text-red-400 text-[10px] font-mono font-bold flex-shrink-0">+{daysLate}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open Issues Summary */}
          {(s.openConflicts > 0 || s.openConstraints > 0) && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Open Issues
              </h3>
              {s.openConflicts > 0 && (
                <Link href={`${base}/conflicts`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/20 transition-colors">
                  <span className="text-orange-300 text-xs">{s.openConflicts} conflict{s.openConflicts !== 1 ? "s" : ""}</span>
                  <ChevronRight className="w-3 h-3 text-orange-500/50" />
                </Link>
              )}
              {s.openConstraints > 0 && (
                <Link href={`${base}/constraints`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 hover:border-yellow-500/10 transition-colors">
                  <span className="text-yellow-300 text-xs">{s.openConstraints} constraint{s.openConstraints !== 1 ? "s" : ""}</span>
                  <ChevronRight className="w-3 h-3 text-yellow-500/50" />
                </Link>
              )}
            </div>
          )}

          {/* All clear state */}
          {issueCount === 0 && (data.topAlerts ?? []).length === 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-emerald-500/20 p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-emerald-400 text-xs font-medium">All clear — no issues</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800/60 p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `${base}/schedule`, label: "Schedule", icon: Calendar, color: "text-violet-400" },
                { href: `${base}/lookaheads`, label: "History", icon: Layers, color: "text-cyan-400" },
                { href: `${base}/analysis`, label: "AI Analysis", icon: Brain, color: "text-fuchsia-400" },
                { href: `${base}/reports`, label: "Reports", icon: Target, color: "text-emerald-400" },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-700/30 hover:border-slate-600 hover:bg-slate-800/30 transition-all">
                  <Icon className={cn("w-3.5 h-3.5", color)} />
                  <span className="text-slate-400 text-[11px] font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ value, label, accent }: { value: number | string; label: string; accent: string }) {
  const colors: Record<string, string> = {
    sky: "border-sky-500/20 text-sky-400",
    violet: "border-violet-500/20 text-violet-400",
    amber: "border-amber-500/20 text-amber-400",
    emerald: "border-emerald-500/20 text-emerald-400",
    red: "border-red-500/20 text-red-400",
    orange: "border-orange-500/20 text-orange-400",
    slate: "border-slate-700/30 text-slate-400",
  };
  return (
    <div className={cn("rounded-lg border bg-slate-900/50 px-3 py-2.5 text-center", colors[accent] ?? colors.slate)}>
      <p className="text-xl font-mono font-bold text-white">{value}</p>
      <p className={cn("text-[9px] font-bold uppercase tracking-wider", colors[accent]?.split(" ")[1] ?? "text-slate-500")}>{label}</p>
    </div>
  );
}
