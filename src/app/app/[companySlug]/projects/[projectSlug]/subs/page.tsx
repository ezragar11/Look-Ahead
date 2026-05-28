"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { HardHat, Loader2, TrendingUp, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  activityDescription: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  percentComplete: number;
  responsibleSubcontractorRaw: string | null;
}

interface SubSummary {
  name: string;
  total: number;
  complete: number;
  inProgress: number;
  delayed: number;
  planned: number;
  avgCompletion: number;
}

const CARD_GRADIENTS = [
  "from-sky-500/10 to-sky-600/5",
  "from-emerald-500/10 to-emerald-600/5",
  "from-violet-500/10 to-violet-600/5",
  "from-orange-500/10 to-orange-600/5",
  "from-cyan-500/10 to-cyan-600/5",
  "from-fuchsia-500/10 to-fuchsia-600/5",
  "from-amber-500/10 to-amber-600/5",
  "from-red-500/10 to-red-600/5",
];

const CARD_BORDERS = [
  "border-sky-500/20", "border-emerald-500/20", "border-violet-500/20", "border-orange-500/20",
  "border-cyan-500/20", "border-fuchsia-500/20", "border-amber-500/20", "border-red-500/20",
];

const BAR_COLORS = [
  "from-sky-500 to-sky-600", "from-emerald-500 to-emerald-600", "from-violet-500 to-violet-600", "from-orange-500 to-orange-600",
  "from-cyan-500 to-cyan-600", "from-fuchsia-500 to-fuchsia-600", "from-amber-500 to-amber-600", "from-red-500 to-red-600",
];

export default function SubcontractorsPage() {
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

  const subMap = new Map<string, SubSummary>();
  activities.forEach((a) => {
    const name = a.responsibleSubcontractorRaw ?? "Unassigned";
    if (!subMap.has(name)) subMap.set(name, { name, total: 0, complete: 0, inProgress: 0, delayed: 0, planned: 0, avgCompletion: 0 });
    const s = subMap.get(name)!;
    s.total++;
    if (a.status === "COMPLETE") s.complete++;
    else if (a.status === "IN_PROGRESS") s.inProgress++;
    else if (a.status === "DELAYED" || a.status === "MISSED" || a.status === "BLOCKED") s.delayed++;
    else s.planned++;
    s.avgCompletion += a.percentComplete;
  });
  const subs = [...subMap.values()].sort((a, b) => b.total - a.total);
  subs.forEach(s => { s.avgCompletion = s.total > 0 ? Math.round(s.avgCompletion / s.total) : 0; });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subcontractors</h1>
        <p className="text-slate-500 text-sm mt-1">{subs.length} subcontractors with {activities.length} total activities</p>
      </div>

      {subs.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
            <HardHat className="w-10 h-10 text-amber-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Subcontractors</p>
          <p className="text-slate-500 text-sm mt-2">Upload a lookahead to populate subcontractor data.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subs.map((s, i) => {
            const pct = s.total > 0 ? Math.round((s.complete / s.total) * 100) : 0;
            const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
            const border = CARD_BORDERS[i % CARD_BORDERS.length];
            const bar = BAR_COLORS[i % BAR_COLORS.length];

            return (
              <div key={s.name} className={cn("rounded-2xl border p-6 bg-gradient-to-br transition-all hover:scale-[1.01]", gradient, border)}>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white font-bold text-lg truncate pr-3">{s.name}</h3>
                  <span className="text-white text-2xl font-black flex-shrink-0">{pct}%</span>
                </div>

                <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden mb-4">
                  <div className={cn("h-full rounded-full bg-gradient-to-r transition-all", bar)} style={{ width: `${pct}%` }} />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center mx-auto mb-1">
                      <span className="text-white text-sm font-bold">{s.total}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-semibold">Total</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-1">
                      <span className="text-emerald-400 text-sm font-bold">{s.complete}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-semibold">Done</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center mx-auto mb-1">
                      <span className="text-amber-400 text-sm font-bold">{s.inProgress}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-semibold">Active</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center mx-auto mb-1">
                      <span className="text-red-400 text-sm font-bold">{s.delayed}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-semibold">Issues</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
