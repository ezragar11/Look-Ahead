"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, AlertTriangle, ShieldAlert, Upload,
  Calendar, Loader2, HardHat, ArrowRight, FolderOpen, TrendingDown,
  Zap, Layers, Brain, Target, MapPin, Users, Flame, Eye,
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
  };
  weekStart: string;
  weeks: WeekSummary[];
  todayActivities: ActivityItem[];
  subsThisWeek: string[];
  overdue: ActivityItem[];
  recentActivities: ActivityItem[];
}

const STATUS_DOT: Record<string, string> = {
  PLANNED: "bg-slate-400", IN_PROGRESS: "bg-amber-400", COMPLETE: "bg-emerald-400",
  DELAYED: "bg-red-400", BLOCKED: "bg-orange-400", MISSED: "bg-rose-500",
};

/* ── Page ── */
export default function ProjectDashboardPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [data, setData]       = useState<DashData | null>(null);
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
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading project...</p>
        </div>
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
  const today = new Date();

  const WEEK_COLORS = [
    { accent: "text-sky-300", bg: "from-sky-500/10 to-sky-600/5", border: "border-sky-500/20", bar: "bg-sky-500", label: "This Week" },
    { accent: "text-violet-300", bg: "from-violet-500/10 to-violet-600/5", border: "border-violet-500/20", bar: "bg-violet-500", label: "Next Week" },
    { accent: "text-emerald-300", bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/20", bar: "bg-emerald-500", label: "Week 3" },
  ];

  return (
    <div className="space-y-8">
      {/* ═══════ Project Header ═══════ */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-white tracking-tight">{p.projectName}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
            {p.location && <span className="text-slate-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.location}</span>}
            {p.client && <span className="text-slate-500">Client: {p.client}</span>}
            {p.contractor && <span className="text-slate-500">GC: {p.contractor}</span>}
          </div>
        </div>
        <Link href={`${base}/upload`}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 flex-shrink-0"
        >
          <Upload className="w-4 h-4" /> Upload Lookahead
        </Link>
      </div>

      {/* ═══════ Jobsite Pulse — What a super sees first ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="rounded-xl p-4 bg-gradient-to-br from-sky-600 to-sky-700 shadow-lg">
          <Zap className="w-5 h-5 text-sky-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.todayCount}</p>
          <p className="text-sky-200 text-[10px] font-bold uppercase tracking-wider">Today&apos;s Work</p>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg">
          <Calendar className="w-5 h-5 text-violet-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.thisWeekCount}</p>
          <p className="text-violet-200 text-[10px] font-bold uppercase tracking-wider">This Week</p>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg">
          <HardHat className="w-5 h-5 text-amber-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.subsOnSite}</p>
          <p className="text-amber-200 text-[10px] font-bold uppercase tracking-wider">Subs On Site</p>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{completionPct}%</p>
          <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">Complete</p>
        </div>
        {s.overdueCount > 0 && (
          <div className="rounded-xl p-4 bg-gradient-to-br from-red-600 to-red-700 shadow-lg">
            <TrendingDown className="w-5 h-5 text-red-200 mb-1.5" />
            <p className="text-3xl font-black text-white">{s.overdueCount}</p>
            <p className="text-red-200 text-[10px] font-bold uppercase tracking-wider">Overdue</p>
          </div>
        )}
        {(s.openConflicts > 0 || s.openConstraints > 0) && (
          <div className="rounded-xl p-4 bg-gradient-to-br from-orange-600 to-orange-700 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-orange-200 mb-1.5" />
            <p className="text-3xl font-black text-white">{s.openConflicts + s.openConstraints}</p>
            <p className="text-orange-200 text-[10px] font-bold uppercase tracking-wider">Open Issues</p>
          </div>
        )}
      </div>

      {/* ═══════ 3-WEEK LOOK-AHEAD — The core of the product ═══════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-400" /> 3-Week Look-Ahead
          </h2>
          <Link href={`${base}/calendar`} className="text-sky-400 hover:text-sky-300 text-xs font-semibold flex items-center gap-1">
            Open Calendar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {data.weeks.map((week, wi) => {
            const wc = WEEK_COLORS[wi];
            const weekStart = new Date(week.start);
            const weekEnd = new Date(week.end);
            const pctDone = week.total > 0 ? Math.round((week.byStatus.complete / week.total) * 100) : 0;

            return (
              <div key={wi} className={cn("rounded-2xl border p-5 bg-gradient-to-br", wc.bg, wc.border)}>
                {/* Week header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={cn("text-lg font-bold", wc.accent)}>{wc.label}</p>
                    <p className="text-slate-500 text-xs">
                      {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-2xl font-black">{week.total}</p>
                    <p className="text-slate-500 text-[10px] font-bold uppercase">Activities</p>
                  </div>
                </div>

                {/* Status bars */}
                {week.total > 0 && (
                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-700/50 mb-3">
                    {week.byStatus.complete > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(week.byStatus.complete / week.total) * 100}%` }} />}
                    {week.byStatus.inProgress > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(week.byStatus.inProgress / week.total) * 100}%` }} />}
                    {week.byStatus.planned > 0 && <div className="bg-slate-500 transition-all" style={{ width: `${(week.byStatus.planned / week.total) * 100}%` }} />}
                    {week.byStatus.delayed > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(week.byStatus.delayed / week.total) * 100}%` }} />}
                  </div>
                )}

                {/* Status counts */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Done", val: week.byStatus.complete, color: "text-emerald-400" },
                    { label: "Active", val: week.byStatus.inProgress, color: "text-amber-400" },
                    { label: "Planned", val: week.byStatus.planned, color: "text-slate-400" },
                    { label: "Issues", val: week.byStatus.delayed, color: "text-red-400" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center">
                      <p className={cn("text-sm font-bold", color)}>{val}</p>
                      <p className="text-slate-600 text-[9px] font-semibold uppercase">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Subs working this week */}
                {week.subs.length > 0 && (
                  <div>
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1">Subs on site</p>
                    <div className="flex flex-wrap gap-1">
                      {week.subs.slice(0, 6).map((sub) => (
                        <span key={sub} className="text-[10px] text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-full truncate max-w-[120px]">{sub}</span>
                      ))}
                      {week.subs.length > 6 && <span className="text-[10px] text-slate-500">+{week.subs.length - 6}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ Two-column: Today's Crew + Overdue ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's work */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" /> Today&apos;s Work
            </h3>
            <Link href={`${base}/daily`} className="text-sky-400 hover:text-sky-300 text-xs font-medium flex items-center gap-1">
              Daily Log <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.todayActivities.length === 0 ? (
            <p className="text-slate-600 text-sm py-4 text-center">No activities scheduled for today.</p>
          ) : (
            <div className="space-y-1.5">
              {data.todayActivities.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_DOT[a.status] ?? "bg-slate-400")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{a.activityDescription}</p>
                    <p className="text-slate-500 text-[11px] truncate">{a.responsibleSubcontractorRaw ?? "Unassigned"}{a.location ? ` · ${a.location}` : ""}</p>
                  </div>
                </div>
              ))}
              {data.todayActivities.length > 8 && (
                <p className="text-sky-400 text-xs px-3">+{data.todayActivities.length - 8} more</p>
              )}
            </div>
          )}
        </div>

        {/* Overdue / attention needed */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" /> Needs Attention
            </h3>
            <Link href={`${base}/delays`} className="text-sky-400 hover:text-sky-300 text-xs font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.overdue.length === 0 && s.openConflicts === 0 && s.openConstraints === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-emerald-400 text-sm font-medium">All clear — no overdue items.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {s.openConflicts > 0 && (
                <Link href={`${base}/conflicts`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/20 transition-all">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span className="text-orange-300 text-sm font-medium">{s.openConflicts} open conflict{s.openConflicts > 1 ? "s" : ""}</span>
                  <ArrowRight className="w-3 h-3 text-orange-500/40 ml-auto" />
                </Link>
              )}
              {s.openConstraints > 0 && (
                <Link href={`${base}/constraints`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 hover:border-yellow-500/20 transition-all">
                  <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-300 text-sm font-medium">{s.openConstraints} open constraint{s.openConstraints > 1 ? "s" : ""}</span>
                  <ArrowRight className="w-3 h-3 text-yellow-500/40 ml-auto" />
                </Link>
              )}
              {data.overdue.map((a) => {
                const daysLate = a.plannedFinish ? Math.max(0, Math.floor((Date.now() - new Date(a.plannedFinish).getTime()) / 86400000)) : 0;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{a.activityDescription}</p>
                      <p className="text-slate-500 text-[11px]">{a.responsibleSubcontractorRaw ?? "Unassigned"}</p>
                    </div>
                    <span className="text-red-400 text-xs font-bold flex-shrink-0">{daysLate}d late</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Subs On Site This Week ═══════ */}
      {data.subsThisWeek.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <HardHat className="w-4 h-4 text-amber-400" /> Subcontractors On Site This Week
            </h3>
            <Link href={`${base}/subs`} className="text-sky-400 hover:text-sky-300 text-xs font-medium flex items-center gap-1">
              All Subs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.subsThisWeek.map((sub) => (
              <span key={sub} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">{sub}</span>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ Quick Nav ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { href: `${base}/schedule`,   label: "Schedule",    icon: Calendar,       from: "from-violet-600/20", iconColor: "text-violet-400" },
          { href: `${base}/calendar`,   label: "Calendar",    icon: Eye,            from: "from-sky-600/20", iconColor: "text-sky-400" },
          { href: `${base}/lookaheads`, label: "Lookaheads",  icon: Layers,         from: "from-cyan-600/20", iconColor: "text-cyan-400" },
          { href: `${base}/subs`,       label: "Subs",        icon: HardHat,        from: "from-amber-600/20", iconColor: "text-amber-400" },
          { href: `${base}/analysis`,   label: "AI Analysis", icon: Brain,          from: "from-fuchsia-600/20", iconColor: "text-fuchsia-400" },
          { href: `${base}/reports`,    label: "Reports",     icon: Target,         from: "from-emerald-600/20", iconColor: "text-emerald-400" },
        ].map(({ href, label, icon: Icon, from, iconColor }) => (
          <Link key={href} href={href}
            className={cn("flex flex-col items-center gap-2 px-3 py-5 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-all bg-gradient-to-br to-transparent", from)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
            <span className="text-slate-300 text-xs font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
