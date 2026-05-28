"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Users, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface SubData {
  id: string;
  name: string;
  trade?: string | null;
  activities: { status: string }[];
}

export default function SubcontractorsPage() {
  const [subs, setSubs]     = useState<SubData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activities?limit=1000")
      .then((r) => r.json())
      .then((data) => {
        // Build subcontractor summary from activities
        const subMap = new Map<string, SubData>();
        for (const a of data.activities ?? []) {
          const sub = a.subcontractor;
          if (!sub) continue;
          if (!subMap.has(sub.id)) {
            subMap.set(sub.id, { ...sub, activities: [] });
          }
          subMap.get(sub.id)!.activities.push({ status: a.status });
        }
        setSubs(Array.from(subMap.values()).sort((a, b) => b.activities.length - a.activities.length));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCcw className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subcontractors</h1>
        <p className="text-gray-500 text-sm mt-1">{subs.length} subcontractors on this project</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subs.map((sub) => {
          const total    = sub.activities.length;
          const complete = sub.activities.filter((a) => a.status === "COMPLETE").length;
          const delayed  = sub.activities.filter((a) => a.status === "DELAYED" || a.status === "BLOCKED").length;
          const planned  = sub.activities.filter((a) => a.status === "PLANNED").length;
          const pct      = total ? Math.round((complete / total) * 100) : 0;

          return (
            <div key={sub.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{sub.name}</h2>
                  {sub.trade && <p className="text-xs text-gray-400 mt-0.5">{sub.trade}</p>}
                </div>
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-emerald-700">{complete}</p>
                  <p className="text-xs text-gray-400">Done</p>
                </div>
                <div className="bg-blue-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-blue-700">{planned}</p>
                  <p className="text-xs text-gray-400">Planned</p>
                </div>
                <div className="bg-orange-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-orange-600">{delayed}</p>
                  <p className="text-xs text-gray-400">Delayed</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Completion</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <p className="text-xs text-gray-400">{total} total activities</p>
            </div>
          );
        })}

        {subs.length === 0 && (
          <div className="col-span-3 text-center py-16">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No subcontractors found. Upload a lookahead first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
