"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { BarChart3, Loader2, TrendingUp, Users, Target, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
  category: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
}

export default function ProjectReportsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    const aRes = await fetch(`/api/activities?projectId=${proj.id}`);
    if (aRes.ok) setActivities(await aRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const total = activities.length;
  const byStatus: Record<string, number> = {};
  const bySub: Record<string, { total: number; complete: number }> = {};
  const byCat: Record<string, number> = {};
  activities.forEach((a) => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    const sub = a.responsibleSubcontractorRaw ?? "Unassigned";
    if (!bySub[sub]) bySub[sub] = { total: 0, complete: 0 };
    bySub[sub].total++;
    if (a.status === "COMPLETE") bySub[sub].complete++;
    const cat = a.category ?? "Uncategorized";
    byCat[cat] = (byCat[cat] || 0) + 1;
  });

  const avgComplete = total > 0 ? Math.round(activities.reduce((s, a) => s + a.percentComplete, 0) / total) : 0;
  const completionRate = total > 0 ? Math.round(((byStatus["COMPLETE"] ?? 0) / total) * 100) : 0;

  const STATUS_BARS: Record<string, { color: string; label: string }> = {
    COMPLETE: { color: "bg-emerald-500", label: "Complete" },
    IN_PROGRESS: { color: "bg-amber-500", label: "In Progress" },
    PLANNED: { color: "bg-slate-500", label: "Planned" },
    DELAYED: { color: "bg-red-500", label: "Delayed" },
    BLOCKED: { color: "bg-orange-500", label: "Blocked" },
    MISSED: { color: "bg-rose-500", label: "Missed" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Project analytics and performance metrics</p>
      </div>

      {total === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 flex items-center justify-center">
            <BarChart3 className="w-10 h-10 text-emerald-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Data Yet</p>
          <p className="text-slate-500 text-sm mt-2">Upload a lookahead to generate reports.</p>
        </div>
      ) : (
        <>
          {/* Top metrics */}
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
            <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-5 shadow-lg">
              <Clock className="w-5 h-5 text-violet-200 mb-2" />
              <p className="text-3xl font-black text-white">{avgComplete}%</p>
              <p className="text-violet-200 text-xs font-semibold uppercase">Avg Progress</p>
            </div>
            <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-2xl p-5 shadow-lg">
              <Users className="w-5 h-5 text-amber-200 mb-2" />
              <p className="text-3xl font-black text-white">{Object.keys(bySub).length}</p>
              <p className="text-amber-200 text-xs font-semibold uppercase">Subcontractors</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status breakdown */}
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

            {/* Subcontractor performance */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <h2 className="text-white font-bold text-lg mb-5">Subcontractor Performance</h2>
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

            {/* Categories */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 lg:col-span-2">
              <h2 className="text-white font-bold text-lg mb-5">By Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat} className="bg-slate-800/50 rounded-xl border border-slate-700/30 p-4 text-center">
                      <p className="text-white text-xl font-black">{count}</p>
                      <p className="text-slate-400 text-xs font-medium truncate mt-1">{cat}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">{pct}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
