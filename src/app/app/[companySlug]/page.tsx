"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban, AlertTriangle, Clock, Users, Upload, Activity,
  Shield, CheckCircle2, Loader2, ArrowRight, Building2, MapPin,
  TrendingUp, Zap, HardHat, BarChart3, Calendar, ShieldAlert,
  Target, Flame, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface ProjectSummary {
  id: string;
  projectName: string;
  slug: string | null;
  status: string;
  location: string | null;
  client: string | null;
  _count: { activities: number; conflicts: number; delays: number; lookaheads: number; constraints: number };
  healthScore: string;
  delayedCount: number;
  openConflicts: number;
  openConstraints: number;
  overdueCount: number;
  completionPct: number;
}

interface CompanyDashboard {
  company: { id: string; name: string; slug: string };
  projects: ProjectSummary[];
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalActivities: number;
    completeActivities: number;
    completionRate: number;
    delayedActivities: number;
    overdueCount: number;
    openConflicts: number;
    openConstraints: number;
    totalUsers: number;
    recentUploads: number;
    thisWeekWork: number;
    atRiskProjects: number;
  };
}

const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  HEALTHY:  { label: "Healthy",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/10" },
  WATCH:    { label: "Watch",    color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/25",  glow: "shadow-yellow-500/10" },
  AT_RISK:  { label: "At Risk",  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25",  glow: "shadow-orange-500/10" },
  CRITICAL: { label: "Critical", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     glow: "shadow-red-500/10" },
};

/* ── Page ── */
export default function CompanyDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [data, setData]       = useState<CompanyDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/dashboard`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <p className="text-slate-400 text-lg">Company not found or you don&apos;t have access.</p>
      </div>
    );
  }

  const s = data.stats;
  const atRisk = data.projects.filter(p => p.healthScore === "AT_RISK" || p.healthScore === "CRITICAL");
  const healthy = data.projects.filter(p => p.healthScore === "HEALTHY");

  return (
    <div className="space-y-8">
      {/* ═══════ Header ═══════ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">{data.company.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            Operations Dashboard &mdash; {s.activeProjects} active project{s.activeProjects !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href={`/app/${companySlug}/projects?new=1`}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 flex-shrink-0"
        >
          <FolderKanban className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* ═══════ Executive KPIs ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <div className="rounded-xl p-4 bg-gradient-to-br from-sky-600 to-sky-700 shadow-lg">
          <FolderKanban className="w-5 h-5 text-sky-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.activeProjects}</p>
          <p className="text-sky-200 text-[10px] font-bold uppercase tracking-wider">Active Projects</p>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg">
          <Calendar className="w-5 h-5 text-violet-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.thisWeekWork}</p>
          <p className="text-violet-200 text-[10px] font-bold uppercase tracking-wider">This Week</p>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg">
          <TrendingUp className="w-5 h-5 text-emerald-200 mb-1.5" />
          <p className="text-3xl font-black text-white">{s.completionRate}%</p>
          <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">Complete</p>
        </div>
        {s.overdueCount > 0 && (
          <div className="rounded-xl p-4 bg-gradient-to-br from-red-600 to-red-700 shadow-lg">
            <Clock className="w-5 h-5 text-red-200 mb-1.5" />
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

      {/* ═══════ Secondary Stats ═══════ */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: "Total Projects",  val: s.totalProjects,      color: "text-sky-400" },
          { label: "Activities",      val: s.totalActivities,    color: "text-slate-300" },
          { label: "Completed",       val: s.completeActivities, color: "text-emerald-400" },
          { label: "Delayed",         val: s.delayedActivities,  color: "text-red-400" },
          { label: "Conflicts",       val: s.openConflicts,      color: "text-orange-400" },
          { label: "Constraints",     val: s.openConstraints,    color: "text-yellow-400" },
          { label: "Team",            val: s.totalUsers,         color: "text-violet-400" },
          { label: "Uploads (7d)",    val: s.recentUploads,      color: "text-cyan-400" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 text-center">
            <p className={cn("text-lg font-black", color)}>{val}</p>
            <p className="text-slate-600 text-[9px] font-semibold uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* ═══════ At-Risk Projects Alert ═══════ */}
      {atRisk.length > 0 && (
        <div className="bg-red-500/5 rounded-2xl border border-red-500/15 p-5">
          <h2 className="text-red-400 font-bold text-lg flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5" /> Projects Needing Attention ({atRisk.length})
          </h2>
          <div className="space-y-2">
            {atRisk.map(p => {
              const hc = HEALTH_CONFIG[p.healthScore] ?? HEALTH_CONFIG.WATCH;
              return (
                <Link key={p.id} href={`/app/${companySlug}/projects/${p.slug ?? p.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:border-red-500/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm group-hover:text-red-300 transition-colors truncate">{p.projectName}</p>
                    {p.location && <p className="text-slate-500 text-xs">{p.location}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {p.overdueCount > 0 && <span className="text-red-400 text-xs font-bold">{p.overdueCount} overdue</span>}
                    {p.openConflicts > 0 && <span className="text-orange-400 text-xs font-bold">{p.openConflicts} conflicts</span>}
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", hc.bg, hc.color, hc.border)}>
                      {hc.label}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-red-400 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ All Projects Grid ═══════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-xl">All Projects</h2>
          <Link href={`/app/${companySlug}/projects`}
            className="text-sky-400 hover:text-sky-300 text-xs font-semibold flex items-center gap-1"
          >
            Manage Projects <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {data.projects.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
            <FolderKanban className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">No Projects Yet</p>
            <p className="text-slate-500 text-sm mt-2 mb-4">Create your first project to get started.</p>
            <Link
              href={`/app/${companySlug}/projects?new=1`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-violet-600 text-white rounded-xl text-sm font-semibold"
            >
              <FolderKanban className="w-4 h-4" /> Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.projects.map((p) => {
              const hc = HEALTH_CONFIG[p.healthScore] ?? HEALTH_CONFIG.WATCH;
              const statusColor = p.status === "ACTIVE" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : p.status === "ON_HOLD" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                : p.status === "COMPLETED" ? "text-sky-400 bg-sky-500/10 border-sky-500/20"
                : "text-slate-400 bg-slate-500/10 border-slate-500/20";

              return (
                <Link
                  key={p.id}
                  href={`/app/${companySlug}/projects/${p.slug ?? p.id}`}
                  className={cn(
                    "block rounded-2xl border p-5 transition-all group hover:scale-[1.01]",
                    hc.bg, hc.border, `hover:shadow-lg ${hc.glow}`
                  )}
                >
                  {/* Project header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-bold text-sm group-hover:text-sky-300 transition-colors truncate">
                        {p.projectName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {p.location && (
                          <span className="text-slate-500 text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {p.location}
                          </span>
                        )}
                        {p.client && <span className="text-slate-600 text-xs">{p.client}</span>}
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border ml-2 whitespace-nowrap", hc.bg, hc.color, hc.border)}>
                      {hc.label}
                    </span>
                  </div>

                  {/* Completion bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 text-[10px] font-semibold uppercase">Progress</span>
                      <span className="text-white text-xs font-bold">{p.completionPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          p.completionPct >= 80 ? "bg-emerald-500" : p.completionPct >= 40 ? "bg-sky-500" : "bg-violet-500"
                        )}
                        style={{ width: `${p.completionPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{p._count.activities}</p>
                      <p className="text-slate-600 text-[9px] font-semibold">Activities</p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-sm font-bold", p.openConflicts > 0 ? "text-orange-400" : "text-white")}>{p.openConflicts}</p>
                      <p className="text-slate-600 text-[9px] font-semibold">Conflicts</p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-sm font-bold", p.overdueCount > 0 ? "text-red-400" : "text-white")}>{p.overdueCount}</p>
                      <p className="text-slate-600 text-[9px] font-semibold">Overdue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{p._count.lookaheads}</p>
                      <p className="text-slate-600 text-[9px] font-semibold">Lookaheads</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusColor)}>
                      {p.status}
                    </span>
                    <span className="text-slate-600 text-[10px] flex items-center gap-1 group-hover:text-sky-400 transition-colors">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════ Health Summary ═══════ */}
      {data.projects.length > 0 && (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-400" /> Project Health Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(["HEALTHY", "WATCH", "AT_RISK", "CRITICAL"] as const).map(level => {
              const hc = HEALTH_CONFIG[level];
              const count = data.projects.filter(p => p.healthScore === level).length;
              return (
                <div key={level} className={cn("rounded-xl border p-4 text-center", hc.bg, hc.border)}>
                  <p className={cn("text-3xl font-black", hc.color)}>{count}</p>
                  <p className={cn("text-xs font-bold uppercase tracking-wider mt-1", hc.color, "opacity-70")}>{hc.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
